import { Dispatch, RefObject, useMemo } from 'react';
import { Gear, Mark, Paragraph, Suggestion } from '../types';
import { Action } from '../reducer';
import { MarkNote } from './MarkNote';
import { SuggestionNote } from './SuggestionNote';
import { EVIDENCE_QUOTES } from '../canned';
import { Pill } from './Pill';

/** Tiny sentiment face, like the feedback tickets. */
const Mood = ({ sad }: { sad: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <circle cx="8" cy="8" r="6.4" />
    <circle cx="5.8" cy="6.6" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="10.2" cy="6.6" r="0.5" fill="currentColor" stroke="none" />
    {sad ? <path d="M5.7 11c.6-.9 1.4-1.4 2.3-1.4s1.7.5 2.3 1.4" /> : <path d="M5.8 10.4h4.4" />}
  </svg>
);

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
  /** Signal/suggestion whose anchored text is hovered — soft highlight. */
  hoveredId: string | null;
  /** Document-order numbering shared with the in-text badges. */
  numbers: Map<string, number>;
  /** Only one card is expanded at a time — owned by the app. */
  expandedSugId: string | null;
  onToggleSug: (id: string) => void;
  onHoverNote: (id: string | null) => void;
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
  hoveredId,
  numbers,
  expandedSugId,
  onToggleSug,
  onHoverNote,
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
      {items.map((item) =>
        item.type === 'mark' ? (
          <MarkNote
            key={item.id}
            mark={item.mark}
            num={numbers.get(item.id)}
            hovered={hoveredId === item.id}
            onHover={(h) => onHoverNote(h ? item.id : null)}
            dispatch={dispatch}
            onOpenEvidence={onOpenEvidence}
            registerEl={(el) => registerNote(item.id, el)}
          />
        ) : (
          <SuggestionNote
            key={item.id}
            sug={item.sug}
            num={numbers.get(item.id)}
            highlighted={highlightedSugId === item.id}
            hovered={hoveredId === item.id}
            expanded={expandedSugId === item.id}
            onToggle={() => onToggleSug(item.id)}
            onHover={(h) => onHoverNote(h ? item.id : null)}
            onOpen={() => onOpenSuggestion(item.id)}
            registerEl={(el) => registerNote(item.id, el)}
          />
        )
      )}

      {/* Evidence is an overlay panel sitting on top of the signals — no
          animation, nothing underneath moves. */}
      {evidenceFor !== null && (
        <div className="evidence-overlay">
          <div className="evidence-bar">
            <span>Evidence</span>
            <button className="evidence-close" onClick={onCloseEvidence} aria-label="Close evidence">
              ✕
            </button>
          </div>
          <div className="evidence-list">
            {EVIDENCE_QUOTES.map((q) => (
              <div className="quote" key={q.tag}>
                <div className="quote-head">
                  <Mood sad={q.sad} />
                  <span>{q.ago}</span>
                </div>
                <p className="quote-text">{q.quote}</p>
                <Pill className={`quote-pill tone-${q.tone}`}>{q.tag}</Pill>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
