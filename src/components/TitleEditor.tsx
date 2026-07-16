import { useLayoutEffect, useRef } from 'react';

interface Props {
  title: string;
  onChange: (title: string) => void;
  onEnter: () => void;
  onEscape: () => void;
}

/** The document title is part of the document — fully editable. */
export function TitleEditor({ title, onChange, onEnter, onEscape }: Props) {
  const ref = useRef<HTMLHeadingElement | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && (el.textContent ?? '') !== title) el.textContent = title;
  });

  return (
    <h1
      ref={ref}
      className="doc-title"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onInput={(e) => onChange(e.currentTarget.textContent ?? '')}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onEnter(); // move into the body
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.currentTarget.blur();
          onEscape();
        }
      }}
    />
  );
}
