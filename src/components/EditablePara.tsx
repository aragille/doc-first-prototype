import { useLayoutEffect, useRef, useState } from 'react';
import { Paragraph } from '../types';
import { caretOffset, placeCaretAtEnd, rectsForRange } from '../text';

/** A decoration painted BEHIND the text (provenance tint, anchor highlight,
 *  shimmer). The editable itself stays plain text, so decorations never
 *  disturb the caret — and can appear/disappear while the user types. */
export interface OverlaySpec {
  key: string;
  className: string;
  start: number;
  end: number;
}

interface Painted {
  key: string;
  className: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Props {
  para: Paragraph;
  overlays: OverlaySpec[];
  isFirst: boolean;
  onInput: (paraId: string, text: string) => void;
  onSplit: (paraId: string, offset: number) => void;
  onMergeBack: (paraId: string) => void;
  /** Fired on click with the caret's character offset — used to light up
   *  the margin note whose anchor contains the caret. */
  onCaretAt: (paraId: string, offset: number) => void;
  onFocusPara: (paraId: string) => void;
  onBlurPara: (paraId: string) => void;
  onEscape: () => void;
  registerEl: (paraId: string, el: HTMLDivElement | null) => void;
}

function samePaint(a: Painted[], b: Painted[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.key !== y.key ||
      x.className !== y.className ||
      Math.abs(x.left - y.left) > 0.5 ||
      Math.abs(x.top - y.top) > 0.5 ||
      Math.abs(x.width - y.width) > 0.5 ||
      Math.abs(x.height - y.height) > 0.5
    ) {
      return false;
    }
  }
  return true;
}

export function EditablePara({
  para,
  overlays,
  isFirst,
  onInput,
  onSplit,
  onMergeBack,
  onCaretAt,
  onFocusPara,
  onBlurPara,
  onEscape,
  registerEl,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [painted, setPainted] = useState<Painted[]>([]);

  // Keep DOM text in sync with state without clobbering the caret. While the
  // user is typing, DOM is the source of truth (onInput → state), so the two
  // already match and this is a no-op. It only fires for external updates
  // (accepting a suggestion, demo typing).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if ((el.textContent ?? '') !== para.text) {
      el.textContent = para.text;
      if (document.activeElement === el) placeCaretAtEnd(el);
    }
  });

  // Measure overlay rects after the text is in the DOM.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const compute = () => {
      const base = el.getBoundingClientRect();
      const next: Painted[] = [];
      for (const o of overlays) {
        rectsForRange(el, o.start, o.end).forEach((r, i) => {
          next.push({
            key: `${o.key}:${i}`,
            className: o.className,
            left: r.left - base.left,
            top: r.top - base.top,
            width: r.width,
            height: r.height,
          });
        });
      }
      setPainted((prev) => (samePaint(prev, next) ? prev : next));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlays, para.text]);

  return (
    <div className="para-wrap">
      <div className="para-overlays" aria-hidden>
        {painted.map((p) => (
          <span
            key={p.key}
            className={p.className}
            style={{ left: p.left, top: p.top, width: p.width, height: p.height }}
          />
        ))}
      </div>
      <div
        ref={(el) => {
          ref.current = el;
          registerEl(para.id, el);
        }}
        className="para-editor"
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-editor={para.id}
        onInput={(e) => onInput(para.id, e.currentTarget.textContent ?? '')}
        onFocus={() => onFocusPara(para.id)}
        onBlur={() => onBlurPara(para.id)}
        onClick={(e) => {
          const sel = window.getSelection();
          if (!sel || !sel.isCollapsed) return; // plain clicks only, not drags
          const off = caretOffset(e.currentTarget);
          if (off !== null) onCaretAt(para.id, off);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            // split the paragraph at the caret
            e.preventDefault();
            const off = caretOffset(e.currentTarget);
            onSplit(para.id, off ?? para.text.length);
            return;
          }
          if (e.key === 'Backspace') {
            // at the very start of a paragraph, merge into the previous one
            const sel = window.getSelection();
            if (sel && sel.isCollapsed && caretOffset(e.currentTarget) === 0 && !isFirst) {
              e.preventDefault();
              onMergeBack(para.id);
            }
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            e.currentTarget.blur();
            onEscape();
          }
        }}
      />
    </div>
  );
}
