import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-menu/style/menu.css';
import 'prosemirror-example-setup/style/style.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import '../style/tables.css';

import { EditorView } from 'prosemirror-view';
import { EditorState } from 'prosemirror-state';
import { DOMParser, Schema } from 'prosemirror-model';
import { schema as baseSchema } from 'prosemirror-schema-basic';
import { keymap } from 'prosemirror-keymap';
import { exampleSetup, buildMenuItems } from 'prosemirror-example-setup';
import { MenuItem, Dropdown } from 'prosemirror-menu';

import {
  addColumnAfter,
  addColumnBefore,
  deleteColumn,
  addBodyAfter,
  addBodyBefore,
  addCaption,
  addRowAfter,
  addRowBefore,
  addTableHead,
  addTableFoot,
  makeBody,
  makeHead,
  makeFoot,
  deleteCaption,
  deleteRow,
  deleteSection,
  mergeCells,
  splitCell,
  setCellAttr,
  toggleHeaderRow,
  toggleHeaderColumn,
  toggleHeaderCell,
  goToNextCell,
  deleteTable,
  setComputedStyleColumnWidths,
  setRelativeColumnWidths,
} from '../src';
import { tableEditing, columnResizing, tableNodes, fixTables } from '../src';

const schema = new Schema({
  nodes: baseSchema.spec.nodes.append(
    tableNodes({
      tableGroup: 'block',
      cellContent: 'block+',
      cellAttributes: {
        background: {
          default: null,
          getFromDOM(dom) {
            return dom.style.backgroundColor || null;
          },
          setDOMAttr(value, attrs) {
            if (value)
              attrs.style = (attrs.style || '') + `background-color: ${value};`;
          },
        },
      },
    }),
  ),
  marks: baseSchema.spec.marks,
});

const menu = buildMenuItems(schema).fullMenu;
function item(label: string, cmd: (state: EditorState) => boolean) {
  return new MenuItem({ label, select: cmd, run: cmd });
}
const tableMenu = [
  item('Set column widths with getComputedStyle', setComputedStyleColumnWidths),
  item(
    'Set column widths to 20%, 60%, 20%',
    setRelativeColumnWidths([0.2, 0.6, 0.2]),
  ),
  item('Add table caption', addCaption),
  item('Delete table caption', deleteCaption),
  item('Add table head', addTableHead),
  item('Add table foot', addTableFoot),
  item('Insert body before', addBodyBefore),
  item('Insert body after', addBodyAfter),
  item('Make new body with selected rows', makeBody),
  item('Make head with selected rows', makeHead),
  item('Make foot with selected rows', makeFoot),
  item('Insert column before', addColumnBefore),
  item('Insert column after', addColumnAfter),
  item('Delete column', deleteColumn),
  item('Insert row before', addRowBefore),
  item('Insert row after', addRowAfter),
  item('Delete row', deleteRow),
  item('Delete section', deleteSection),
  item('Delete table', deleteTable),
  item('Merge cells', mergeCells),
  item('Split cell', splitCell),
  item('Toggle header column', toggleHeaderColumn),
  item('Toggle header row', toggleHeaderRow),
  item('Toggle header cells', toggleHeaderCell),
  item('Make cell green', setCellAttr('background', '#dfd')),
  item('Make cell not-green', setCellAttr('background', null)),
];
menu.splice(2, 0, [new Dropdown(tableMenu, { label: 'Table' })]);

const contentElement = document.querySelector('#content');
if (!contentElement) {
  throw new Error('Failed to find #content');
}
const doc = DOMParser.fromSchema(schema).parse(contentElement);

let state = EditorState.create({
  doc,
  plugins: [
    columnResizing(),
    tableEditing(),
    keymap({
      Tab: goToNextCell(1),
      'Shift-Tab': goToNextCell(-1),
    }),
  ].concat(
    exampleSetup({
      schema,
      menuContent: menu,
    }),
  ),
});
const fix = fixTables(state);
if (fix) state = state.apply(fix.setMeta('addToHistory', false));

(window as any).view = new EditorView(document.querySelector('#editor'), {
  state,
});
