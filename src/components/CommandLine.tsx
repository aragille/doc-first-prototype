import { useState } from 'react';

interface Props {
  x: number;
  y: number;
  onSubmit: (query: string) => void;
  onDismiss: () => void;
}

/** The line: a one-line input attached to the selection. Not centered, not
 *  modal, and deliberately no conversation history. */
export function CommandLine({ x, y, onSubmit, onDismiss }: Props) {
  const [v, setV] = useState('');
  return (
    <div className="cmdline" style={{ left: x, top: y }}>
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder="Ask about this selection…"
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && v.trim()) onSubmit(v.trim());
          if (e.key === 'Escape') onDismiss();
        }}
        onBlur={onDismiss}
      />
    </div>
  );
}
