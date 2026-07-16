import { Suggestion } from '../types';

interface Props {
  sug: Suggestion;
  /** True when the caret sits inside the anchored text / popover is open. */
  highlighted: boolean;
  onOpen: () => void;
  registerEl: (el: HTMLDivElement | null) => void;
}

/**
 * The signal card for a suggestion carries only the valuable part: the
 * proposal and why. The decision (accept / reject / refine) happens in a
 * popover over the anchored text — click the card to go there.
 */
export function SuggestionNote({ sug, highlighted, onOpen, registerEl }: Props) {
  return (
    <div
      className={`note sug-note ${highlighted ? 'note-focused' : ''}`}
      ref={registerEl}
      onClick={onOpen}
    >
      <div className="note-head">
        <span className="pill pill-suggestion">Suggestion</span>
        <span className="note-go">Review →</span>
      </div>
      <p className="sug-prop">{sug.proposedText}</p>
      <p className="note-rationale">{sug.rationale}</p>
    </div>
  );
}
