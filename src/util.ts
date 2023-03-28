// Various helper function for working with tables

import { EditorState, NodeSelection, PluginKey } from 'prosemirror-state';

import { Attrs, Node, ResolvedPos } from 'prosemirror-model';
import { CellSelection } from './cellselection';
import { isTableSection, tableNodeTypes } from './schema';
import { Rect, TableMap } from './tablemap';

/**
 * @public
 */
export type MutableAttrs = Record<string, unknown>;

/**
 * @public
 */
export interface CellAttrs {
  colspan: number;
  rowspan: number;
  colwidth: number[] | null;
}

/**
 * @public
 */
export const tableEditingKey = new PluginKey<number>('selectingCells');

/**
 * @public
 */
export function cellAround($pos: ResolvedPos): ResolvedPos | null {
  for (let d = $pos.depth - 1; d > 0; d--)
    if ($pos.node(d).type.spec.tableRole == 'row')
      return $pos.node(0).resolve($pos.before(d + 1));
  return null;
}

export function cellWrapping($pos: ResolvedPos): null | Node {
  for (let d = $pos.depth; d > 0; d--) {
    // Sometimes the cell can be in the same depth.
    const role = $pos.node(d).type.spec.tableRole;
    if (role === 'cell' || role === 'header_cell') return $pos.node(d);
  }
  return null;
}

/**
 * @public
 */
export function isInTable(state: EditorState): boolean {
  const $head = state.selection.$head;
  for (let d = $head.depth; d > 0; d--)
    if ($head.node(d).type.spec.tableRole == 'row') return true;
  return false;
}

/**
 * @internal
 */
export function selectionCell(state: EditorState): ResolvedPos {
  const sel = state.selection as CellSelection | NodeSelection;
  if ('$anchorCell' in sel && sel.$anchorCell) {
    return sel.$anchorCell.pos > sel.$headCell.pos
      ? sel.$anchorCell
      : sel.$headCell;
  } else if (
    'node' in sel &&
    sel.node &&
    sel.node.type.spec.tableRole == 'cell'
  ) {
    return sel.$anchor;
  }
  const $cell = cellAround(sel.$head) || cellNear(sel.$head);
  if ($cell) {
    return $cell;
  }
  throw new RangeError(`No cell found around position ${sel.head}`);
}

function cellNear($pos: ResolvedPos): ResolvedPos | undefined {
  for (
    let after = $pos.nodeAfter, pos = $pos.pos;
    after;
    after = after.firstChild, pos++
  ) {
    const role = after.type.spec.tableRole;
    if (role == 'cell' || role == 'header_cell') return $pos.doc.resolve(pos);
  }
  for (
    let before = $pos.nodeBefore, pos = $pos.pos;
    before;
    before = before.lastChild, pos--
  ) {
    const role = before.type.spec.tableRole;
    if (role == 'cell' || role == 'header_cell')
      return $pos.doc.resolve(pos - before.nodeSize);
  }
}

/**
 * @public
 */
export function pointsAtCell($pos: ResolvedPos): boolean {
  return $pos.parent.type.spec.tableRole == 'row' && !!$pos.nodeAfter;
}

/**
 * @public
 */
export function moveCellForward($pos: ResolvedPos): ResolvedPos {
  return $pos.node(0).resolve($pos.pos + $pos.nodeAfter!.nodeSize);
}

/**
 * @internal
 */
export function inSameTable($cellA: ResolvedPos, $cellB: ResolvedPos): boolean {
  return (
    $cellA.depth == $cellB.depth &&
    $cellA.pos >= $cellB.start(-2) &&
    $cellA.pos <= $cellB.end(-2)
  );
}

/**
 * @public
 */
export function findCell($pos: ResolvedPos): Rect {
  return TableMap.get($pos.node(-2)).findCell($pos.pos - $pos.start(-2));
}

/**
 * @public
 */
export function colCount($pos: ResolvedPos): number {
  return TableMap.get($pos.node(-2)).colCount($pos.pos - $pos.start(-2));
}

/**
 * @public
 */
export function nextCell(
  $pos: ResolvedPos,
  axis: 'horiz' | 'vert',
  dir: number,
): ResolvedPos | null {
  const table = $pos.node(-2);
  const map = TableMap.get(table);
  const tableStart = $pos.start(-2);

  const moved = map.nextCell($pos.pos - tableStart, axis, dir);
  return moved == null ? null : $pos.node(0).resolve(tableStart + moved);
}

/**
 * @public
 */
export function removeColSpan(attrs: CellAttrs, pos: number, n = 1): CellAttrs {
  const result: CellAttrs = { ...attrs, colspan: attrs.colspan - n };

  if (result.colwidth) {
    result.colwidth = result.colwidth.slice();
    result.colwidth.splice(pos, n);
    if (!result.colwidth.some((w) => w > 0)) result.colwidth = null;
  }
  return result;
}

/**
 * @public
 */
export function addColSpan(attrs: CellAttrs, pos: number, n = 1): Attrs {
  const result = { ...attrs, colspan: attrs.colspan + n };
  if (result.colwidth) {
    result.colwidth = result.colwidth.slice();
    for (let i = 0; i < n; i++) result.colwidth.splice(pos, 0, 0);
  }
  return result;
}

/**
 * @public
 */
export function columnIsHeader(
  map: TableMap,
  table: Node,
  col: number,
): boolean {
  const headerCell = tableNodeTypes(table.type.schema).header_cell;
  for (let row = 0; row < map.height; row++)
    if (table.nodeAt(map.map[col + row * map.width])!.type != headerCell)
      return false;
  return true;
}

/**
 * @public
 */
export function rowsCount(table: Node) {
  let count = 0;
  for (let c = 0; c < table.childCount; c++) {
    const section = table.child(c);
    if (isTableSection(section))
      count += section.childCount;
  }
  return count;
}

/**
 * @public
 */
export function getRow(
  table: Node,
  row: number,
  offset: number = 0,
  // debug: boolean = false,
): { node: Node | null; pos: number; section: number } {
  let rPos = offset;
  let prevSectionsRows = 0;
  let sectionIndex = -1
  for (let tc = 0; tc < table.childCount; tc++) {
    const section = table.child(tc);
    if (isTableSection(section)) {
      sectionIndex++;
      const sectionRows = section.childCount;
      if (sectionRows > 0) {
        // if (debug)
        //   console.log(
        //     `looking for row ${row} in section ${s}: ${section.type.name} with ${sectionRows} rows; prevSectionRows=${prevSectionsRows}`,
        //   );
        if (prevSectionsRows + sectionRows <= row) {
          if (tc === table.childCount - 1) {
            return {
              node: null,
              pos: rPos + section.nodeSize - 1,
              section: sectionIndex
            };
          }
          rPos += section.nodeSize;
          prevSectionsRows += sectionRows;
        } else {
          rPos++; // section opening tag
          let r = 0;
          while (r < sectionRows) {
            if (prevSectionsRows + r === row) break;
            rPos += section.child(r).nodeSize;
            r++;
          }
          if (r === sectionRows) rPos++;
          // if (debug)
          //   console.log(`row ${row} found @ pos ${rPos}, section ${s}`);
          return {
            node: r >= sectionRows ? null : section.child(r),
            pos: rPos,
            section: sectionIndex
          };
        }
      }
    } else {
      // caption
      rPos += section.nodeSize;
    }
  }
  return { node: null, pos: rPos, section: sectionIndex };
}

/**
 * @public
 */
export function rowPos(
  table: Node,
  row: number,
  pos: number = 0,
  // debug: boolean = false,
) {
  return getRow(table, row, pos /* debug */).pos;
}

/**
 * @public
 */
export function rowAtPos(table: Node, pos: number): number {
  let rpos = 0;
  let row = 0;
  for (let c = 0; c < table.childCount; c++) {
    const section = table.child(c);
    if (isTableSection(section)) {
      rpos++;
      for (let r = 0; r < section.childCount; r++) {
        rpos += section.child(r).nodeSize;
        if (pos < rpos) return row;
        row++;
      }
      rpos++;
    } else {
      rpos += section.nodeSize;
    }
  }
  return row;
}
