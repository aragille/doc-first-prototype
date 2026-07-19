import { useLayoutEffect, useRef, useState } from 'react';
import { FormatRange, Paragraph } from '../types';
import { caretOffset, offsetFromPoint, placeCaretAtEnd, rectsForRange } from '../text';
import { buildParaHtml, parseEditable } from '../richtext';

/** A decoration painted BEHIND the text (provenance tint, anchor highlight,
 *  shimmer). The editable itself stays plain text, so decorations never
 *  disturb the caret — and can appear/disappear while the user types. */
export interface OverlaySpec {
  key: string;
  className: string;
  start: number;
  end: number;
}

/** A tiny numbered stance badge (e.g. "2✕") rendered as a superscript at the
 *  START of its anchored range — painted in an overlay layer above the text,
 *  so the editable stays plain and nothing reflows. */
export interface BadgeSpec {
  key: string;
  className: string;
  label: string;
  offset: number;
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
  badges: BadgeSpec[];
  isFirst: boolean;
  onInput: (paraId: string, text: string, formats: FormatRange[]) => void;
  onSplit: (paraId: string, offset: number) => void;
  onMergeBack: (paraId: string) => void;
  /** Fired on click with the caret's character offset — used to light up
   *  the margin note whose anchor contains the caret. */
  onCaretAt: (paraId: string, offset: number) => void;
  /** Fired while hovering with the character offset under the pointer
   *  (null when leaving) — soft-highlights the related signal. */
  onHoverAt: (paraId: string, offset: number | null) => void;
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
  badges,
  isFirst,
  onInput,
  onSplit,
  onMergeBack,
  onCaretAt,
  onHoverAt,
  onFocusPara,
  onBlurPara,
  onEscape,
  registerEl,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [painted, setPainted] = useState<Painted[]>([]);
  const [paintedBadges, setPaintedBadges] = useState<
    Array<{ key: string; className: string; label: string; left: number; top: number }>
  >([]);
  const lastHtml = useRef<string | null>(null);

  // Keep DOM in sync with state without clobbering the caret. While the
  // user is typing, DOM is the source of truth (onInput → state), so this is
  // a no-op. Unfocused paragraphs render rich HTML built from text + format
  // ranges; focused external updates (accept, demo typing) set plain text.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) {
      if ((el.textContent ?? '') !== para.text) {
        el.textContent = para.text;
        lastHtml.current = null;
        placeCaretAtEnd(el);
      }
    } else {
      const html = buildParaHtml(para.text, para.formats);
      if (lastHtml.current !== html || (el.textContent ?? '') !== para.text) {
        el.innerHTML = html;
        lastHtml.current = html;
      }
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
      const nextBadges = badges.flatMap((b) => {
        const r = rectsForRange(el, b.offset, Math.min(b.offset + 1, (el.textContent ?? '').length))[0];
        if (!r) return [];
        return [
          {
            key: b.key,
            className: b.className,
            label: b.label,
            left: r.left - base.left - 3,
            top: r.top - base.top - 7,
          },
        ];
      });
      setPaintedBadges((prev) =>
        prev.length === nextBadges.length &&
        prev.every(
          (p, i) =>
            p.key === nextBadges[i].key &&
            p.label === nextBadges[i].label &&
            p.className === nextBadges[i].className &&
            Math.abs(p.left - nextBadges[i].left) < 0.5 &&
            Math.abs(p.top - nextBadges[i].top) < 0.5
        )
          ? prev
          : nextBadges
      );
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlays, badges, para.text, para.formats]);

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
      <div className="para-badges" aria-hidden>
        {paintedBadges.map((b) => (
          <span key={b.key} className={`anchor-badge ${b.className}`} style={{ left: b.left, top: b.top }}>
            {b.label}
          </span>
        ))}
      </div>
      <div
        ref={(el) => {
          ref.current = el;
          registerEl(para.id, el);
        }}
        className={`para-editor kind-${para.kind}`}
        contentEditable
        suppressContentEditableWarning
        spellCheck={false}
        data-editor={para.id}
        onInput={(e) => {
          const parsed = parseEditable(e.currentTarget);
          lastHtml.current = null; // DOM is ahead of state while focused
          onInput(para.id, parsed.text, parsed.formats);
        }}
        onFocus={() => onFocusPara(para.id)}
        onBlur={() => onBlurPara(para.id)}
        onClick={(e) => {
          const sel = window.getSelection();
          if (!sel || !sel.isCollapsed) return; // plain clicks only, not drags
          const off = caretOffset(e.currentTarget);
          if (off !== null) onCaretAt(para.id, off);
        }}
        onMouseMove={(e) => {
          onHoverAt(para.id, offsetFromPoint(e.currentTarget, e.clientX, e.clientY));
        }}
        onMouseLeave={() => onHoverAt(para.id, null)}
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
