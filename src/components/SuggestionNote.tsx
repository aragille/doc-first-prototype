import { Suggestion } from '../types';
import { Pill } from './Pill';
import { SparkIcon } from './SparkIcon';

interface Props {
  sug: Suggestion;
  num: number | undefined;
  /** True when the caret sits inside the anchored text / popover is open. */
  highlighted: boolean;
  /** True while the anchored text is hovered. */
  hovered: boolean;
  /** Expanded state is owned by the app — only one card is open at a time. */
  expanded: boolean;
  onToggle: () => void;
  onHover: (hovering: boolean) => void;
  onOpen: () => void;
  registerEl: (el: HTMLDivElement | null) => void;
}

/**
 * A suggestion card: one line collapsed (number · Suggestion · preview),
 * expanding on click to the proposal, rationale, and the route to the
 * in-doc decision popover.
 */
export function SuggestionNote({
  sug,
  num,
  highlighted,
  hovered,
  expanded,
  onToggle,
  onHover,
  onOpen,
  registerEl,
}: Props) {
  const isOpen = expanded || highlighted;

  return (
    <div
      className={`note sug-note ${isOpen ? 'note-focused' : ''} ${hovered ? 'note-hover' : ''}`}
      ref={registerEl}
      onClick={onToggle}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className={`note-line ${isOpen ? 'open' : ''}`}>
        {num !== undefined && <span className="num-badge">{num}</span>}
        <Pill className="pill-suggestion" icon={false}>
          Suggest
        </Pill>
        {!isOpen && <span className="note-preview">{sug.proposedText}</span>}
      </div>
      {isOpen && (
        <>
          <p className="sug-prop">
            <span className="sug-spark">
              <SparkIcon size={14} />
            </span>
            {sug.proposedText}
          </p>
          <p className="note-rationale">{sug.rationale}</p>
          <div className="note-actions" onClick={(e) => e.stopPropagation()}>
            <button className="btn-accent" onClick={onOpen}>
              Review
            </button>
          </div>
        </>
      )}
    </div>
  );
}
