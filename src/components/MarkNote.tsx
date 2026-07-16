import { Dispatch, useState } from 'react';
import { Mark } from '../types';
import { Action } from '../reducer';

const KIND_LABEL: Record<Mark['kind'], string> = {
  evidence: 'Evidence',
  contradiction: 'Contradicts',
  question: 'Question',
};

interface Props {
  mark: Mark;
  dispatch: Dispatch<Action>;
  onOpenEvidence: (mark: Mark) => void;
  registerEl: (el: HTMLDivElement | null) => void;
}

/** An insight note: kind pill, always-visible text (no hover required),
 *  quiet actions. Clicking it highlights the anchored text in the document. */
export function MarkNote({ mark, dispatch, onOpenEvidence, registerEl }: Props) {
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');

  const sendReply = () => {
    if (!text.trim()) return;
    dispatch({ type: 'user/replyMark', id: mark.id, text: text.trim() });
    setText('');
    setReplying(false);
  };

  const focused = mark.state === 'open';

  return (
    <div
      className={`note ${focused ? 'note-focused' : ''}`}
      ref={registerEl}
      onClick={() =>
        dispatch(
          focused ? { type: 'user/closeMark', id: mark.id } : { type: 'user/openMark', id: mark.id }
        )
      }
    >
      <div className="note-head">
        <span className={`pill pill-${mark.kind}`}>{KIND_LABEL[mark.kind]}</span>
        <span className="note-source">{mark.sourceLabel}</span>
      </div>
      <p className="note-text">{mark.text}</p>
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
        <button onClick={() => dispatch({ type: 'user/dismissMark', id: mark.id })}>Dismiss</button>
      </div>
      {replying && (
        <input
          className="note-input"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Reply…"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') sendReply();
            if (e.key === 'Escape') setReplying(false);
          }}
        />
      )}
    </div>
  );
}
