import { Dispatch, RefObject, useMemo } from 'react';
import { Gear, Mark, Paragraph, Suggestion } from '../types';
import { Action } from '../reducer';
import { MarkNote } from './MarkNote';
import { SuggestionNote } from './SuggestionNote';

/**
 * The insights panel — the AI's only territory. A fixed, independently
 * scrollable rail on the right; notes flow in document order. The document
 * column never reflows because of AI activity, and gear transitions change
 * opacity only.
 */

export type GutterItem =
  | { id: string; paraId: string; type: 'mark'; mark: Mark }
  | { id: string; paraId: string; type: 'sug'; sug: Suggestion };

interface Props {
  paras: Paragraph[];
  marks: Mark[];
  suggestions: Suggestion[];
  gear: Gear;
  /** Suggestion whose anchored text currently holds the caret. */
  highlightedSugId: string | null;
  dispatch: Dispatch<Action>;
  gutterRef: RefObject<HTMLDivElement>;
  registerNote: (id: string, el: HTMLDivElement | null) => void;
  onOpenEvidence: (mark: Mark) => void;
  onOpenSuggestion: (sugId: string) => void;
  onWake: () => void;
}

export function Gutter({
  paras,
  marks,
  suggestions,
  gear,
  highlightedSugId,
  dispatch,
  gutterRef,
  registerNote,
  onOpenEvidence,
  onOpenSuggestion,
  onWake,
}: Props) {
  // Document order: for each paragraph, its marks then its suggestion.
  const items = useMemo<GutterItem[]>(() => {
    const list: GutterItem[] = [];
    for (const p of paras) {
      for (const m of marks) {
        if (m.anchor.paraId === p.id && m.state !== 'queued') {
          list.push({ id: m.id, paraId: p.id, type: 'mark', mark: m });
        }
      }
      for (const s of suggestions) {
        if (s.anchor.paraId === p.id && s.state === 'pending') {
          list.push({ id: s.id, paraId: p.id, type: 'sug', sug: s });
        }
      }
    }
    return list;
  }, [paras, marks, suggestions]);

  return (
    <div
      className="gutter"
      ref={gutterRef}
      onMouseDown={() => {
        if (gear === 'writing') onWake();
      }}
    >
      <div className="gutter-head">
        Signals <span className="gutter-count">{items.length}</span>
      </div>
      {items.map((item) =>
        item.type === 'mark' ? (
          <MarkNote
            key={item.id}
            mark={item.mark}
            dispatch={dispatch}
            onOpenEvidence={onOpenEvidence}
            registerEl={(el) => registerNote(item.id, el)}
          />
        ) : (
          <SuggestionNote
            key={item.id}
            sug={item.sug}
            highlighted={highlightedSugId === item.id}
            onOpen={() => onOpenSuggestion(item.id)}
            registerEl={(el) => registerNote(item.id, el)}
          />
        )
      )}
    </div>
  );
}
