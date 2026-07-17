/**
 * State model.
 *
 * THE CENTRAL INVARIANT — the AI cannot write to the document — is enforced
 * structurally here, not by styling or convention:
 *
 *   - AI/system actions ('ai/*', 'sys/*') are routed to `annotationReducer`,
 *     whose signature is (ai: AiState, action) => AiState. It never receives
 *     the document, so no AI code path CAN mutate document text.
 *   - Document text is only touched inside `userReducer`, and only by two
 *     cases: 'user/input' (keystrokes) and 'user/acceptSuggestion'
 *     (explicit acceptance).
 *
 * Grep test: search this file for `doc` — it appears only in `userReducer`.
 */

import {
  AiState,
  Anchor,
  AppState,
  BlockKind,
  FormatRange,
  Mark,
  ParaSnapshot,
  Paragraph,
  Suggestion,
  ThreadMsg,
} from './types';
import { adjustRange, ChangeBounds, diffBounds } from './text';
import { rebaseFormats, shiftFormats, splitFormats } from './richtext';
import { CANNED_THREAD_REPLIES, nextRefinement } from './canned';

/* ---------------- actions ---------------- */

export type UserAction =
  | { type: 'user/input'; paraId: string; text: string; formats?: FormatRange[] }
  | { type: 'user/setTitle'; title: string }
  | { type: 'user/setKind'; paraId: string; kind: BlockKind }
  | { type: 'user/toggleTodo'; paraId: string }
  | { type: 'user/splitPara'; paraId: string; offset: number; newParaId: string }
  | { type: 'user/mergePara'; paraId: string }
  | { type: 'user/restoreVersion'; title: string; paras: ParaSnapshot[] }
  | { type: 'user/undo'; state: AppState }
  | { type: 'user/acceptSuggestion'; id: string }
  | { type: 'user/rejectSuggestion'; id: string }
  | { type: 'user/refineSuggestion'; id: string; query: string }
  | { type: 'user/dismissMark'; id: string }
  | { type: 'user/openMark'; id: string }
  | { type: 'user/closeMark'; id: string }
  | { type: 'user/replyMark'; id: string; text: string };

/** Scripted AI events may only create marks and suggestions — there is no
 *  action shape through which they could carry document edits. */
export type AnnotationAction =
  | { type: 'ai/addMark'; mark: Mark }
  | { type: 'ai/addSuggestion'; suggestion: Suggestion }
  | {
      /** Presence follows the user's attention: queued items materialize on
       *  idle/review, never on the paragraph holding the caret. */
      type: 'sys/materialize';
      activeParaId: string | null;
      maxVisibleMarks: number;
    };

export type Action = UserAction | AnnotationAction;

export function isAnnotationAction(a: Action): a is AnnotationAction {
  return a.type === 'ai/addMark' || a.type === 'ai/addSuggestion' || a.type === 'sys/materialize';
}

/* ---------------- root ---------------- */

export function rootReducer(state: AppState, action: Action): AppState {
  if (isAnnotationAction(action)) {
    const ai = annotationReducer(state.ai, action);
    return ai === state.ai ? state : { ...state, ai };
  }
  return userReducer(state, action);
}

/* ---------------- AI side: cannot see the document ---------------- */

function annotationReducer(ai: AiState, action: AnnotationAction): AiState {
  switch (action.type) {
    case 'ai/addMark':
      return { ...ai, marks: [...ai.marks, { ...action.mark, state: 'queued' }] };

    case 'ai/addSuggestion':
      return {
        ...ai,
        suggestions: [...ai.suggestions, { ...action.suggestion, state: 'queued' }],
      };

    case 'sys/materialize': {
      const visible = ai.marks.filter((m) => m.state !== 'queued').length;
      let budget = Math.max(0, action.maxVisibleMarks - visible);
      let changed = false;
      const marks = ai.marks.map((m) => {
        if (m.state === 'queued' && m.anchor.paraId !== action.activeParaId && budget > 0) {
          budget--;
          changed = true;
          return { ...m, state: 'dot' as const };
        }
        return m;
      });
      const suggestions = ai.suggestions.map((s) => {
        if (s.state === 'queued' && s.anchor.paraId !== action.activeParaId) {
          changed = true;
          return { ...s, state: 'pending' as const };
        }
        return s;
      });
      return changed ? { ...ai, marks, suggestions } : ai;
    }
  }
}

/* ---------------- user side ---------------- */

function userReducer(state: AppState, action: UserAction): AppState {
  switch (action.type) {
    case 'user/input': {
      const para = state.doc.paras.find((p) => p.id === action.paraId);
      if (!para || para.text === action.text) return state;
      const change = diffBounds(para.text, action.text);
      // Provenance clears the moment the user edits inside it (overlap → null).
      const provenance = para.provenance
        ? (() => {
            const r = adjustRange(para.provenance, change);
            return r ? { ...para.provenance, ...r } : null;
          })()
        : null;
      // Formats either come parsed from the DOM (rich edits) or are rebased
      // across the change (plain programmatic typing).
      const formats = action.formats ?? rebaseFormats(para.formats, change);
      const paras = state.doc.paras.map((p) =>
        p.id === para.id ? { ...p, text: action.text, formats, provenance } : p
      );
      return {
        doc: { ...state.doc, paras },
        ai: rebaseAnnotations(state.ai, para.id, change),
      };
    }

    case 'user/setTitle':
      return { ...state, doc: { ...state.doc, title: action.title } };

    // ⌘Z: user-initiated wholesale restore of an earlier state snapshot.
    case 'user/undo':
      return action.state;

    case 'user/setKind': {
      const paras = state.doc.paras.map((p) =>
        p.id === action.paraId
          ? { ...p, kind: action.kind, done: action.kind === 'todo' ? p.done : false }
          : p
      );
      return { ...state, doc: { ...state.doc, paras } };
    }

    case 'user/toggleTodo': {
      const paras = state.doc.paras.map((p) =>
        p.id === action.paraId && p.kind === 'todo' ? { ...p, done: !p.done } : p
      );
      return { ...state, doc: { ...state.doc, paras } };
    }

    // Enter: split a paragraph at the caret. Anchors follow their text —
    // entirely before the split they stay, entirely after they move to the
    // new paragraph, spanning the split they die.
    case 'user/splitPara': {
      const idx = state.doc.paras.findIndex((p) => p.id === action.paraId);
      if (idx === -1) return state;
      const para = state.doc.paras[idx];
      const offset = Math.max(0, Math.min(action.offset, para.text.length));
      const prov = para.provenance;
      const fmts = splitFormats(para.formats, offset);
      const first: Paragraph = {
        ...para,
        text: para.text.slice(0, offset),
        formats: fmts.first,
        provenance: prov && prov.end <= offset ? prov : null,
      };
      const second: Paragraph = {
        id: action.newParaId,
        text: para.text.slice(offset),
        // Enter continues lists; headings hand off to body text.
        kind: para.kind === 'bullet' || para.kind === 'todo' ? para.kind : 'p',
        done: false,
        formats: fmts.second,
        provenance:
          prov && prov.start >= offset
            ? { ...prov, start: prov.start - offset, end: prov.end - offset }
            : null,
      };
      const paras = [
        ...state.doc.paras.slice(0, idx),
        first,
        second,
        ...state.doc.paras.slice(idx + 1),
      ];
      const move = (a: Anchor): Anchor | null => {
        if (a.end <= offset) return a;
        if (a.start >= offset)
          return { paraId: action.newParaId, start: a.start - offset, end: a.end - offset };
        return null;
      };
      const marks = state.ai.marks.flatMap((m) => {
        if (m.anchor.paraId !== action.paraId) return [m];
        const a = move(m.anchor);
        return a ? [{ ...m, anchor: a }] : [];
      });
      const suggestions = state.ai.suggestions.flatMap((s) => {
        if (s.anchor.paraId !== action.paraId) return [s];
        const a = move(s.anchor);
        return a ? [{ ...s, anchor: a }] : [];
      });
      return { doc: { ...state.doc, paras }, ai: { marks, suggestions } };
    }

    // Backspace at paragraph start: merge into the previous paragraph.
    // Anchors on the merged paragraph shift by the junction offset.
    case 'user/mergePara': {
      const idx = state.doc.paras.findIndex((p) => p.id === action.paraId);
      if (idx <= 0) return state;
      const prev = state.doc.paras[idx - 1];
      const para = state.doc.paras[idx];
      const junction = prev.text.length;
      const provenance =
        prev.provenance ??
        (para.provenance
          ? {
              ...para.provenance,
              start: para.provenance.start + junction,
              end: para.provenance.end + junction,
            }
          : null);
      const merged: Paragraph = {
        ...prev,
        text: prev.text + para.text,
        formats: [...prev.formats, ...shiftFormats(para.formats, junction)],
        provenance,
      };
      const paras = [
        ...state.doc.paras.slice(0, idx - 1),
        merged,
        ...state.doc.paras.slice(idx + 1),
      ];
      const shift = (a: Anchor): Anchor =>
        a.paraId === para.id
          ? { paraId: prev.id, start: a.start + junction, end: a.end + junction }
          : a;
      const marks = state.ai.marks.map((m) => ({ ...m, anchor: shift(m.anchor) }));
      const suggestions = state.ai.suggestions.map((s) => ({ ...s, anchor: shift(s.anchor) }));
      return { doc: { ...state.doc, paras }, ai: { marks, suggestions } };
    }

    // Restoring a version is a user action — the one other way (besides
    // typing and accepting) that document text changes. Annotations survive
    // only if their anchors still fit the restored text.
    case 'user/restoreVersion': {
      const paras: Paragraph[] = action.paras.map((p) => ({
        id: p.id,
        text: p.text,
        kind: p.kind,
        done: p.done,
        formats: p.formats,
        provenance: null,
      }));
      const textById = new Map(paras.map((p) => [p.id, p.text]));
      const marks = state.ai.marks.filter((m) => {
        const t = textById.get(m.anchor.paraId);
        return t !== undefined && m.anchor.end <= t.length;
      });
      const suggestions = state.ai.suggestions.filter((s) => {
        const t = textById.get(s.anchor.paraId);
        return (
          t !== undefined &&
          s.anchor.end <= t.length &&
          t.slice(s.anchor.start, s.anchor.end) === s.originalText
        );
      });
      return { doc: { title: action.title, paras }, ai: { marks, suggestions } };
    }

    case 'user/acceptSuggestion': {
      const sug = state.ai.suggestions.find((s) => s.id === action.id);
      if (!sug) return state;
      const para = state.doc.paras.find((p) => p.id === sug.anchor.paraId);
      if (!para) return state;
      // A suggestion can never exceed its anchor: the replacement applies
      // only to [start, end) of its one anchored paragraph.
      const { start, end } = sug.anchor;
      const text = para.text.slice(0, start) + sug.proposedText + para.text.slice(end);
      const change: ChangeBounds = { start, oldEnd: end, newEnd: start + sug.proposedText.length };
      const paras = state.doc.paras.map((p) =>
        p.id === para.id
          ? {
              ...p,
              text,
              formats: rebaseFormats(p.formats, change),
              provenance: { start, end: change.newEnd, acceptedAt: Date.now() },
            }
          : p
      );
      const ai = rebaseAnnotations(state.ai, para.id, change);
      return {
        doc: { ...state.doc, paras },
        ai: { ...ai, suggestions: ai.suggestions.filter((s) => s.id !== sug.id) },
      };
    }

    case 'user/rejectSuggestion':
      return {
        ...state,
        ai: { ...state.ai, suggestions: state.ai.suggestions.filter((s) => s.id !== action.id) },
      };

    case 'user/refineSuggestion': {
      // Refining loops forever: scripted step first, then rotating variants.
      const suggestions = state.ai.suggestions.map((s) => {
        if (s.id !== action.id) return s;
        const next = nextRefinement(s);
        return { ...s, ...next, refineCount: s.refineCount + 1 };
      });
      return { ...state, ai: { ...state.ai, suggestions } };
    }

    case 'user/dismissMark':
      return {
        ...state,
        ai: { ...state.ai, marks: state.ai.marks.filter((m) => m.id !== action.id) },
      };

    case 'user/openMark': {
      // One card at a time — everything else collapses back to a dot.
      const marks = state.ai.marks.map((m) => {
        if (m.id === action.id) return { ...m, state: 'open' as const };
        if (m.state === 'open') return { ...m, state: 'dot' as const };
        return m;
      });
      return { ...state, ai: { ...state.ai, marks } };
    }

    case 'user/closeMark': {
      const marks = state.ai.marks.map((m) =>
        m.id === action.id && m.state === 'open' ? { ...m, state: 'dot' as const } : m
      );
      return { ...state, ai: { ...state.ai, marks } };
    }

    case 'user/replyMark': {
      const marks = state.ai.marks.map((m) => {
        if (m.id !== action.id) return m;
        const aiReplies = m.thread.filter((t) => t.author === 'margin').length;
        const reply =
          CANNED_THREAD_REPLIES[Math.min(aiReplies, CANNED_THREAD_REPLIES.length - 1)];
        const msgs: ThreadMsg[] = [
          ...m.thread,
          { id: `t-${Date.now()}-u`, author: 'you', text: action.text },
          { id: `t-${Date.now()}-a`, author: 'margin', text: reply },
        ];
        return { ...m, thread: msgs };
      });
      return { ...state, ai: { ...state.ai, marks } };
    }
  }
}

/** Keep anchors honest across a document edit: shift what can shift,
 *  drop what the edit invalidated. */
function rebaseAnnotations(ai: AiState, paraId: string, change: ChangeBounds): AiState {
  const marks = ai.marks.flatMap((m) => {
    if (m.anchor.paraId !== paraId) return [m];
    const r = adjustRange(m.anchor, change);
    return r ? [{ ...m, anchor: { ...m.anchor, ...r } }] : [];
  });
  const suggestions = ai.suggestions.flatMap((s) => {
    if (s.anchor.paraId !== paraId) return [s];
    const r = adjustRange(s.anchor, change);
    return r ? [{ ...s, anchor: { ...s.anchor, ...r } }] : [];
  });
  return { marks, suggestions };
}
