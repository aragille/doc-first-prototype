/** Text-range utilities: diffing, anchor rebasing, DOM range measurement. */

export interface ChangeBounds {
  start: number;
  oldEnd: number;
  newEnd: number;
}

/** Locate the changed region between two versions of a paragraph. */
export function diffBounds(oldText: string, newText: string): ChangeBounds {
  let start = 0;
  const min = Math.min(oldText.length, newText.length);
  while (start < min && oldText[start] === newText[start]) start++;
  let oldEnd = oldText.length;
  let newEnd = newText.length;
  while (oldEnd > start && newEnd > start && oldText[oldEnd - 1] === newText[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }
  return { start, oldEnd, newEnd };
}

/**
 * Rebase a range across an edit.
 * - edit entirely after the range → unchanged
 * - edit entirely before the range → shifted
 * - edit overlaps the range → null (the anchor is no longer valid)
 * The "overlap → null" case is exactly the provenance rule: editing any
 * character inside a tinted range clears it.
 */
export function adjustRange(
  range: { start: number; end: number },
  c: ChangeBounds
): { start: number; end: number } | null {
  const delta = c.newEnd - c.oldEnd;
  if (c.start >= range.end) return range;
  if (c.oldEnd <= range.start) return { start: range.start + delta, end: range.end + delta };
  return null;
}

/** Client rects covering [start, end) of the text inside `el`. */
export function rectsForRange(el: HTMLElement, start: number, end: number): DOMRect[] {
  if (end <= start) return [];
  const range = document.createRange();
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let startSet = false;
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    if (!startSet && start <= pos + len) {
      range.setStart(node, Math.max(0, start - pos));
      startSet = true;
    }
    if (startSet && end <= pos + len) {
      range.setEnd(node, Math.max(0, end - pos));
      return Array.from(range.getClientRects());
    }
    pos += len;
  }
  if (!startSet) return [];
  range.setEnd(el, el.childNodes.length);
  return Array.from(range.getClientRects());
}

/** Character offsets of the current selection within `el` (clamped to it). */
export function selectionOffsets(el: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const textLen = (el.textContent ?? '').length;
  const end = Math.min(start + range.toString().length, textLen);
  if (end <= start) return null;
  return { start, end };
}

/** Caret offset within `el` (works for collapsed selections). */
export function caretOffset(el: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const r = sel.getRangeAt(0);
  if (!el.contains(r.startContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  pre.setEnd(r.startContainer, r.startOffset);
  return pre.toString().length;
}

/** Focus `el` and place a collapsed caret at a character offset. */
export function placeCaretAt(el: HTMLElement, offset: number): void {
  el.focus();
  const range = document.createRange();
  let pos = 0;
  let placed = false;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const len = node.textContent?.length ?? 0;
    if (offset <= pos + len) {
      range.setStart(node, Math.max(0, offset - pos));
      range.collapse(true);
      placed = true;
      break;
    }
    pos += len;
  }
  if (!placed) {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

/** Character offset under a pointer position (for hover detection). */
export function offsetFromPoint(el: HTMLElement, x: number, y: number): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  let node: Node | null = null;
  let off = 0;
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(x, y);
    if (!p) return null;
    node = p.offsetNode;
    off = p.offset;
  } else if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(x, y);
    if (!r) return null;
    node = r.startContainer;
    off = r.startOffset;
  }
  if (!node || !el.contains(node)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(el);
  try {
    pre.setEnd(node, off);
  } catch {
    return null;
  }
  return pre.toString().length;
}

export function placeCaretAtEnd(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}
