import { useRef, useState } from 'react';

interface Props {
  placeholder: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

/**
 * The product's inline input: quiet bordered field with an ✕ inside.
 * Enter submits, Esc cancels, ✕ cancels, clicking anywhere outside cancels.
 * Used for signal replies and suggestion refinement.
 */
export function NoteInput({ placeholder, onSubmit, onCancel }: Props) {
  const [v, setV] = useState('');
  const wrapRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="note-input-wrap" ref={wrapRef} onClick={(e) => e.stopPropagation()}>
      <input
        className="note-input-field"
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter' && v.trim()) onSubmit(v.trim());
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={(e) => {
          // Clicking out cancels — unless focus moved within this field.
          if (
            wrapRef.current &&
            e.relatedTarget instanceof Node &&
            wrapRef.current.contains(e.relatedTarget)
          ) {
            return;
          }
          onCancel();
        }}
      />
      <button
        className="note-input-cancel"
        aria-label="Cancel"
        onMouseDown={(e) => e.preventDefault()} // keep focus so blur doesn't double-cancel
        onClick={onCancel}
      >
        ✕
      </button>
    </div>
  );
}
