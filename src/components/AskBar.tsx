import { useState } from 'react';
import { SparkIcon } from './SparkIcon';

interface Props {
  /** True when a text selection is armed — asks apply to it. */
  hasSelection: boolean;
  /** True while the scripted "thinking" beat plays. */
  thinking: boolean;
  onArmSelection: () => void;
  onSubmit: (query: string) => void;
}

/**
 * Prompting as a first-class citizen: a slim, persistent ask bar docked
 * under the document. It is deliberately NOT a chat — there is no history,
 * no transcript. Every answer lands as an anchored signal or suggestion in
 * the margin, and the bar clears.
 */
export function AskBar({ hasSelection, thinking, onArmSelection, onSubmit }: Props) {
  const [v, setV] = useState('');

  return (
    <div className="ask-bar" onMouseDown={onArmSelection}>
      <div className={`ask-bar-inner ${thinking ? 'thinking' : ''}`}>
        <span className="ask-bar-spark">
          <SparkIcon size={15} />
        </span>
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={
            thinking
              ? 'Noctua is reading…'
              : hasSelection
                ? 'Ask Noctua about the selection…'
                : 'Ask Noctua about this doc…'
          }
          disabled={thinking}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter' && v.trim() && !thinking) {
              onSubmit(v.trim());
              setV('');
            }
            if (e.key === 'Escape') {
              setV('');
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
        {hasSelection && !thinking && <span className="ask-bar-chip">selection</span>}
        <kbd>⏎</kbd>
      </div>
    </div>
  );
}
