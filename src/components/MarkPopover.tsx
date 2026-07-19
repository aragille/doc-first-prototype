import { Dispatch, useEffect, useRef } from 'react';
import { Mark, Stance } from '../types';
import { Action } from '../reducer';
import { Pill } from './Pill';

const STANCE_LABEL: Record<Stance, string> = {
  agrees: 'Agree',
  disagrees: 'Disagree',
  questions: 'Question',
};

interface Props {
  mark: Mark;
  num: number | undefined;
  x: number;
  y: number;
  above: boolean;
  dispatch: Dispatch<Action>;
  onOpenEvidence: (mark: Mark) => void;
  onClose: () => void;
}

/** Signals open over the text too, just like suggestions: stance, the
 *  note, and quiet actions — anchored to the sentence they're about. */
export function MarkPopover({ mark, num, x, y, above, dispatch, onOpenEvidence, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Keyboard: Esc closes (handled globally too, this catches focus cases)
    const el = ref.current;
    if (!el) return;
  }, []);

  return (
    <div
      ref={ref}
      className={`sug-popover mark-popover ${above ? 'above' : ''}`}
      style={{ left: x, top: y }}
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="note-line open">
        {num !== undefined && <span className="num-badge">{num}</span>}
        <Pill className={`pill-${mark.stance}`} icon={false}>
          {STANCE_LABEL[mark.stance]}
        </Pill>
      </div>
      <p className="mark-pop-text">{mark.text}</p>
      <div className="note-actions">
        <button
          onClick={() => {
            onOpenEvidence(mark);
            onClose();
          }}
        >
          Evidence
        </button>
        <button
          onClick={() => {
            dispatch({ type: 'user/dismissMark', id: mark.id });
            onClose();
          }}
        >
          Dismiss
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
