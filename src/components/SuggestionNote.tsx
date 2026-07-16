import { Suggestion } from '../types';
import { SparkIcon } from './SparkIcon';

interface Props {
  sug: Suggestion;
  /** True when the caret sits inside the anchored text / popover is open. */
  highlighted: boolean;
  /** True while the anchored text is hovered. */
  hovered: boolean;
  onHover: (hovering: boolean) => void;
  onOpen: () => void;
  registerEl: (el: HTMLDivElement | null) => void;
}

/**
 * The signal card for a suggestion carries only the valuable part: the
 * proposal and why. The decision (accept / reject / refine) happens in a
 * popover over the anchored text — click the card to go there.
 */
export function SuggestionNote({ sug, highlighted, hovered, onHover, onOpen, registerEl }: Props) {
  return (
    <div
      className={`note sug-note ${highlighted ? 'note-focused' : ''} ${hovered ? 'note-hover' : ''}`}
      ref={registerEl}
      onClick={onOpen}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="note-head">
        <span className="pill pill-suggestion">Suggestion</span>
        <span className="note-go">Review →</span>
      </div>
      <p className="sug-prop">
        <span className="sug-spark">
          <SparkIcon size={14} />
        </span>
        {sug.proposedText}
      </p>
      <p className="note-rationale">{sug.rationale}</p>
    </div>
  );
}
