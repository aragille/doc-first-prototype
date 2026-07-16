/** Inline rich text: formatting lives as ranges over plain text, rendered
 *  as <strong>/<em>/<u> and parsed back from the contenteditable DOM. */

import { FormatRange, InlineStyle } from './types';
import { adjustRange, ChangeBounds } from './text';

const STYLES: InlineStyle[] = ['b', 'i', 'u', 's'];

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Render plain text + format ranges to HTML for the editable. */
export function buildParaHtml(text: string, formats: FormatRange[]): string {
  if (!text) return '';
  const bounds = new Set<number>([0, text.length]);
  for (const f of formats) {
    bounds.add(Math.max(0, Math.min(f.start, text.length)));
    bounds.add(Math.max(0, Math.min(f.end, text.length)));
  }
  const pts = [...bounds].sort((a, b) => a - b);
  let html = '';
  for (let k = 0; k < pts.length - 1; k++) {
    const a = pts[k];
    const b = pts[k + 1];
    if (a >= b) continue;
    let seg = escapeHtml(text.slice(a, b));
    const has = (s: InlineStyle) =>
      formats.some((f) => f.style === s && f.start <= a && f.end >= b);
    if (has('s')) seg = `<s>${seg}</s>`;
    if (has('u')) seg = `<u>${seg}</u>`;
    if (has('i')) seg = `<em>${seg}</em>`;
    if (has('b')) seg = `<strong>${seg}</strong>`;
    html += seg;
  }
  return html;
}

function stylesFor(node: Node, root: HTMLElement): Set<InlineStyle> {
  const set = new Set<InlineStyle>();
  let cur = node.parentElement;
  while (cur && cur !== root) {
    const t = cur.tagName;
    if (t === 'B' || t === 'STRONG') set.add('b');
    if (t === 'I' || t === 'EM') set.add('i');
    if (t === 'U') set.add('u');
    if (t === 'S' || t === 'STRIKE' || t === 'DEL') set.add('s');
    // execCommand sometimes emits styled spans instead of tags
    const st = cur.style;
    if (st.fontWeight === 'bold' || Number(st.fontWeight) >= 600) set.add('b');
    if (st.fontStyle === 'italic') set.add('i');
    if (st.textDecoration.includes('underline')) set.add('u');
    if (st.textDecoration.includes('line-through')) set.add('s');
    cur = cur.parentElement;
  }
  return set;
}

/** Read the editable's DOM back into plain text + format ranges. */
export function parseEditable(el: HTMLElement): { text: string; formats: FormatRange[] } {
  let text = '';
  const formats: FormatRange[] = [];
  const runs: Record<InlineStyle, number | null> = { b: null, i: null, u: null, s: null };
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const styles = stylesFor(node, el);
    const startPos = text.length;
    text += node.textContent ?? '';
    for (const s of STYLES) {
      const has = styles.has(s);
      if (has && runs[s] === null) runs[s] = startPos;
      if (!has && runs[s] !== null) {
        formats.push({ start: runs[s]!, end: startPos, style: s });
        runs[s] = null;
      }
    }
  }
  for (const s of STYLES) {
    if (runs[s] !== null) formats.push({ start: runs[s]!, end: text.length, style: s });
  }
  return { text, formats };
}

/** Rebase format ranges across an edit (shift what can shift, drop overlaps). */
export function rebaseFormats(formats: FormatRange[], change: ChangeBounds): FormatRange[] {
  return formats.flatMap((f) => {
    const r = adjustRange(f, change);
    return r ? [{ ...f, ...r }] : [];
  });
}

/** Split format ranges at an offset (Enter). Ranges spanning the split are
 *  cut into one piece per side. */
export function splitFormats(
  formats: FormatRange[],
  offset: number
): { first: FormatRange[]; second: FormatRange[] } {
  const first: FormatRange[] = [];
  const second: FormatRange[] = [];
  for (const f of formats) {
    if (f.end <= offset) {
      first.push(f);
    } else if (f.start >= offset) {
      second.push({ ...f, start: f.start - offset, end: f.end - offset });
    } else {
      first.push({ ...f, end: offset });
      second.push({ ...f, start: 0, end: f.end - offset });
    }
  }
  return { first, second };
}

/** Shift format ranges by a fixed amount (merge). */
export function shiftFormats(formats: FormatRange[], by: number): FormatRange[] {
  return formats.map((f) => ({ ...f, start: f.start + by, end: f.end + by }));
}
