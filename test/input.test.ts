import ist from 'ist';
import { Node, ResolvedPos } from 'prosemirror-model';
import { EditorState, Selection } from 'prosemirror-state';
import { Mappable } from 'prosemirror-transform';
import { EditorView } from 'prosemirror-view';
import { describe, it } from 'vitest';

import { handleKeyDown } from '../src/input';
import { doc, p } from './build';

class GapCursor extends Selection {
  constructor($pos: ResolvedPos) {
    super($pos, $pos);
  }

  map(doc: Node, mapping: Mappable): Selection {
    return new GapCursor(doc.resolve(mapping.map(this.head)));
  }

  eq(other: Selection): boolean {
    return other instanceof GapCursor && other.head == this.head;
  }

  toJSON(): { type: string; pos: number } {
    return { type: 'gapcursor', pos: this.head };
  }
}

function arrowDown(state: EditorState): boolean {
  const view = { state, endOfTextblock: () => true } as unknown as EditorView;
  const event = { key: 'ArrowDown', keyCode: 40 } as KeyboardEvent;
  return handleKeyDown(view, event);
}

describe('handleKeyDown', () => {
  it('leaves a vertical arrow to other handlers at a top-level gap cursor', () => {
    const testDoc = doc(p('a'), p('b'));
    const state = EditorState.create({
      doc: testDoc,
      selection: new GapCursor(testDoc.resolve(3)),
    });

    ist(state.selection.$anchor.depth, 0);
    ist(arrowDown(state), false);
  });
});
