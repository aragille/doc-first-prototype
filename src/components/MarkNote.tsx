import { Dispatch, useState } from 'react';
import { Mark, Stance } from '../types';
import { Action } from '../reducer';
import { NoteInput } from './NoteInput';
import { Pill } from './Pill';

/** The card leads with the AI's stance, not the evidence type. */
const STANCE_LABEL: Record<Stance, string> = {
  agrees: 'Agree',
  disagrees: 'Disagree',
  questions: 'Question',
};

interface Props {
  mark: Mark;
  num: number | undefined;
  hovered: boolean;
  onHover: (hovering: boolean) => void;
  dispatch: Dispatch<Action>;
  onOpenEvidence: (mark: Mark) => void;
  registerEl: (el: HTMLDivElement | null) => void;
}

/**
 * A signal card: one line collapsed (number · stance · preview), expanding
 * on click to the full text, thread, and actions.
 */
export function MarkNote({ mark, num, hovered, onHover, dispatch, onOpenEvidence, registerEl }: Props) {
  const [replying, setReplying] = useState(false);
  const expanded = mark.state === 'open';

  const sendReply = (text: string) => {
    dispatch({ type: 'user/replyMark', id: mark.id, text });
    setReplying(false);
  };

  return (
    <div
      className={`note ${expanded ? 'note-focused' : ''} ${hovered ? 'note-hover' : ''}`}
      ref={registerEl}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={() =>
        dispatch(
          expanded ? { type: 'user/closeMark', id: mark.id } : { type: 'user/openMark', id: mark.id }
        )
      }
    >
      <div className={`note-line ${expanded ? 'open' : ''}`}>
        {num !== undefined && <span className="num-badge">{num}</span>}
        <Pill className={`pill-${mark.stance}`} icon={false}>
          {STANCE_LABEL[mark.stance]}
        </Pill>
        {!expanded && <span className="note-preview">{mark.text}</span>}
      </div>
      {expanded && (
        <>
          <p className="mark-text">{mark.text}</p>
          {mark.thread.length > 0 && (
            <div className="thread">
              {mark.thread.map((t) => (
                <p key={t.id} className={`thread-msg ${t.author}`}>
                  <span>{t.author === 'you' ? 'you' : 'signals'}</span>
                  {t.text}
                </p>
              ))}
            </div>
          )}
          <div className="note-actions" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => onOpenEvidence(mark)}>Evidence</button>
            {mark.thread.length < 4 && !replying && (
              <button onClick={() => setReplying(true)}>Reply</button>
            )}
            <button onClick={() => dispatch({ type: 'user/dismissMark', id: mark.id })}>
              Dismiss
            </button>
          </div>
          {replying && (
            <NoteInput
              placeholder="Reply…"
              onSubmit={sendReply}
              onCancel={() => setReplying(false)}
            />
          )}
        </>
      )}
    </div>
  );
}
