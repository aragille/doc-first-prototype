import { Dispatch, RefObject, useMemo } from 'react';
import { Gear, Mark, Paragraph, Suggestion } from '../types';
import { Action } from '../reducer';
import { MarkNote } from './MarkNote';
import { SuggestionNote } from './SuggestionNote';
import { EVIDENCE_QUOTES } from '../canned';

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
  /** When set, the panel drills one level deeper into evidence. */
  evidenceFor: string | null;
  onCloseEvidence: () => void;
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
  evidenceFor,
  onCloseEvidence,
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
      {/* Evidence is one level deeper inside the same panel. */}
      {evidenceFor !== null && (
        <div className="gutter-evidence">
          <div className="gutter-head">
            <button className="gutter-back" onClick={onCloseEvidence} aria-label="Back to signals">
              ←
            </button>
            Evidence
          </div>
          <p className="gutter-evidence-sub">{evidenceFor || 'churn interviews'}</p>
          {EVIDENCE_QUOTES.map((q) => (
            <div className="quote" key={q.source}>
              {q.quote}
              <br />
              <span className="quote-chip">{q.source}</span>
            </div>
          ))}
        </div>
      )}

      {evidenceFor === null && (
        <div className="gutter-head">
          Signals <span className="gutter-count">{items.length}</span>
        </div>
      )}
      {evidenceFor === null &&
        items.map((item) =>
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
