import { Dispatch, useEffect, useRef, useState } from 'react';
import { Suggestion } from '../types';
import { Action } from '../reducer';
import { NoteInput } from './NoteInput';

interface Props {
  sug: Suggestion;
  x: number;
  y: number;
  above: boolean;
  autoFocus: boolean;
  dispatch: Dispatch<Action>;
  onClose: () => void;
}

/**
 * The decision surface for a suggestion: a small popover anchored over the
 * tinted text itself. Accept / Reject / Refine happen here, in the document —
 * the margin card is just the preview. Keyboard: ⏎ accept, ⌫ reject,
 * R refine, Esc close.
 */
export function SuggestionPopover({ sug, x, y, above, autoFocus, dispatch, onClose }: Props) {
  const [refining, setRefining] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const canRefine = !!sug.refined && !sug.refineUsed;

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const accept = () => {
    dispatch({ type: 'user/acceptSuggestion', id: sug.id });
    onClose();
  };
  const reject = () => {
    dispatch({ type: 'user/rejectSuggestion', id: sug.id });
    onClose();
  };
  const refine = (query: string) => {
    dispatch({ type: 'user/refineSuggestion', id: sug.id, query });
    setRefining(false);
    ref.current?.focus({ preventScroll: true }); // keyboard stays live on the popover
  };

  return (
    <div
      ref={ref}
      className={`sug-popover ${above ? 'above' : ''}`}
      style={{ left: x, top: y }}
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (refining) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          accept();
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          reject();
        } else if ((e.key === 'r' || e.key === 'R') && canRefine) {
          e.preventDefault();
          setRefining(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <p className="sug-pop-prop">{sug.proposedText}</p>
      <p className="sug-pop-rationale">{sug.rationale}</p>
      <div className="sug-pop-actions">
        <button className="btn-primary" onClick={accept}>
          Accept<kbd>⏎</kbd>
        </button>
        <button onClick={reject}>
          Reject<kbd>⌫</kbd>
        </button>
        {canRefine && (
          <button onClick={() => setRefining(true)}>
            Refine<kbd>R</kbd>
          </button>
        )}
      </div>
      {refining && (
        <NoteInput
          placeholder="Refine — e.g. “who exactly, and by when?”"
          onSubmit={refine}
          onCancel={() => setRefining(false)}
        />
      )}
    </div>
  );
}
