import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Anchor, BlockKind, FormatRange, Gear, Mark } from './types';
import { Action, rootReducer } from './reducer';
import { CMDK_POOL, DOC_ASK_POOL, docAskMark, seedState } from './canned';
import { AskBar } from './components/AskBar';
import { placeCaretAt, placeCaretAtEnd, rectsForRange, selectionOffsets } from './text';
import { SuggestionPopover } from './components/SuggestionPopover';
import { MarkPopover } from './components/MarkPopover';
import { HistoryView, VersionSnap } from './components/HistoryView';

const HistoryIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 8a5.5 5.5 0 1 1 1.6 3.9M2.5 8V4.8M2.5 8h3.2" />
    <path d="M8 5.2V8l2 1.4" />
  </svg>
);

const SharedIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="5.5" r="2.2" />
    <path d="M2 13c.5-2 2.1-3 4-3s3.5 1 4 3" />
    <path d="M10.6 3.8a2.2 2.2 0 0 1 0 3.5M11.8 10.2c1 .4 1.8 1.3 2.2 2.6" />
  </svg>
);
import { ParaBlock } from './components/ParaBlock';
import { Gutter } from './components/Gutter';
import { CommandLine } from './components/CommandLine';
import { TitleEditor } from './components/TitleEditor';
import { Sidebar } from './components/Sidebar';
import { DocList } from './components/DocList';
import { SparkIcon } from './components/SparkIcon';
import { useDemo } from './demo';

const IDLE_MS = 4000; // writing → review after ~4s of stillness
const MAX_VISIBLE_MARKS = 12; // hard cap; extras queue

/** Actions that land on the ⌘Z stack (transient open/close ones don't). */
const UNDOABLE = new Set<string>([
  'user/input',
  'user/setTitle',
  'user/setKind',
  'user/toggleTodo',
  'user/splitPara',
  'user/mergePara',
  'user/acceptSuggestion',
  'user/rejectSuggestion',
  'user/refineSuggestion',
  'user/dismissMark',
  'user/replyMark',
  'user/restoreVersion',
]);

function isTypingTarget(t: EventTarget | null): boolean {
  return (
    t instanceof HTMLElement &&
    (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')
  );
}

export default function App() {
  const demoFlag = useMemo(
    () => new URLSearchParams(window.location.search).get('demo') === '1',
    []
  );
  const [state, dispatch] = useReducer(rootReducer, demoFlag, seedState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const [gear, setGear] = useState<Gear>('writing');
  const [activeParaId, setActiveParaId] = useState<string | null>(null);
  const [drawerFor, setDrawerFor] = useState<string | null>(null); // evidence drill-in
  const [fmtBar, setFmtBar] = useState<{ x: number; y: number } | null>(null);
  const [cmdk, setCmdk] = useState<{ anchor: Anchor; x: number; y: number } | null>(null);
  const [shimmer, setShimmer] = useState<Anchor | null>(null);
  const [highlightedSugId, setHighlightedSugId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const openMarkId = state.ai.marks.find((m) => m.state === 'open')?.id ?? null;
  const [sugPopover, setSugPopover] = useState<{
    sugId: string;
    x: number;
    y: number;
    above: boolean;
    autoFocus: boolean;
  } | null>(null);
  const sugPopoverRef = useRef(sugPopover);
  sugPopoverRef.current = sugPopover;
  const [markPopover, setMarkPopover] = useState<{
    markId: string;
    x: number;
    y: number;
    above: boolean;
  } | null>(null);
  const markPopoverRef = useRef(markPopover);
  markPopoverRef.current = markPopover;
  const [expandedSugId, setExpandedSugId] = useState<string | null>(null);

  /* ---------- version history ---------- */

  const [versions, setVersions] = useState<VersionSnap[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<number | null>(null);
  const versionIdRef = useRef(4);
  const historyOpenRef = useRef(historyOpen);
  historyOpenRef.current = historyOpen;

  // Seed a believable history from the current doc: an early draft, a longer
  // draft, and the version on screen.
  useEffect(() => {
    const now = Date.now();
    const title = stateRef.current.doc.title;
    const paras = stateRef.current.doc.paras.map((p) => ({
      id: p.id,
      text: p.text,
      kind: p.kind,
      done: p.done,
      formats: p.formats,
    }));
    setVersions([
      { id: 1, at: now - 2 * 86400_000 - 3_600_000, title, paras: paras.slice(0, 4) },
      { id: 2, at: now - 86400_000 - 7_200_000, title, paras: paras.slice(0, 8) },
      { id: 3, at: now - 3 * 3_600_000, title, paras },
    ]);
  }, []);

  // Snapshot the doc (skips if nothing changed since the last version).
  const pushVersion = useCallback((restoredFrom?: number) => {
    window.setTimeout(() => {
      const title = stateRef.current.doc.title;
      const paras = stateRef.current.doc.paras.map((p) => ({
        id: p.id,
        text: p.text,
        kind: p.kind,
        done: p.done,
        formats: p.formats,
      }));
      setVersions((prev) => {
        const last = prev[prev.length - 1];
        const same =
          last && last.title === title && JSON.stringify(last.paras) === JSON.stringify(paras);
        if (same && restoredFrom === undefined) return prev;
        return [
          ...prev.slice(-29),
          { id: versionIdRef.current++, at: Date.now(), title, paras, restoredFrom },
        ];
      });
    }, 80);
  }, []);

  /* ---------- undo (⌘Z) / redo (⇧⌘Z) ---------- */

  const undoRef = useRef<ReturnType<typeof seedState>[]>([]);
  const redoRef = useRef<ReturnType<typeof seedState>[]>([]);
  const lastInputRef = useRef<{ paraId: string; at: number } | null>(null);

  // The single dispatch for user actions: snapshots for ⌘Z (consecutive
  // keystrokes in one paragraph coalesce into one undo step) and versions
  // for accepted suggestions.
  const appDispatch = useCallback(
    (action: Action) => {
      if (UNDOABLE.has(action.type)) {
        const now = Date.now();
        const coalesce =
          action.type === 'user/input' &&
          lastInputRef.current !== null &&
          lastInputRef.current.paraId === action.paraId &&
          now - lastInputRef.current.at < 800;
        if (!coalesce) undoRef.current = [...undoRef.current.slice(-99), stateRef.current];
        lastInputRef.current =
          action.type === 'user/input' ? { paraId: action.paraId, at: now } : null;
        redoRef.current = [];
      }
      dispatch(action);
      if (action.type === 'user/acceptSuggestion') pushVersion();
    },
    [pushVersion]
  );


  const editorEls = useRef(new Map<string, HTMLDivElement>());
  const pendingFocus = useRef<{ paraId: string; offset: number } | null>(null);
  const noteEls = useRef(new Map<string, HTMLDivElement>());
  const gutterRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const poolIdx = useRef(0);
  const askPoolIdx = useRef(0);
  const armedSelection = useRef<Anchor | null>(null);
  const [askThinking, setAskThinking] = useState(false);
  const [askHasSelection, setAskHasSelection] = useState(false);
  const cmdkRef = useRef(cmdk);
  cmdkRef.current = cmdk;
  const drawerRef = useRef(drawerFor);
  drawerRef.current = drawerFor;

  /* ---------- gear machine ---------- */

  const notifyTyping = useCallback(() => {
    setGear('writing');
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setGear('review'), IDLE_MS);
  }, []);

  const undo = useCallback(() => {
    const prev = undoRef.current.pop();
    if (!prev) return;
    redoRef.current.push(stateRef.current);
    lastInputRef.current = null;
    dispatch({ type: 'user/undo', state: prev });
    notifyTyping();
  }, [notifyTyping]);

  const redo = useCallback(() => {
    const next = redoRef.current.pop();
    if (!next) return;
    undoRef.current.push(stateRef.current);
    lastInputRef.current = null;
    dispatch({ type: 'user/undo', state: next });
    notifyTyping();
  }, [notifyTyping]);

  // The doc opens with the caret parked in P4, writing gear, idle clock running.
  useEffect(() => {
    const el = editorEls.current.get('p4');
    if (el) {
      el.focus();
      placeCaretAtEnd(el);
    }
    idleTimer.current = window.setTimeout(() => setGear('review'), IDLE_MS);
    return () => window.clearTimeout(idleTimer.current);
  }, []);

  // Scrolling away from the caret also enters review gear.
  useEffect(() => {
    const onScroll = () => {
      if (!activeParaId) return;
      const el = editorEls.current.get(activeParaId);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) setGear('review');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeParaId]);

  /* ---------- materialization: presence follows attention ---------- */

  useEffect(() => {
    if (gear !== 'review') return;
    const t = window.setTimeout(
      () => dispatch({ type: 'sys/materialize', activeParaId, maxVisibleMarks: MAX_VISIBLE_MARKS }),
      150
    );
    return () => window.clearTimeout(t);
  }, [gear, activeParaId, state.ai.marks, state.ai.suggestions]);

  // Going idle is a natural checkpoint — snapshot if the text changed.
  useEffect(() => {
    if (gear === 'review') pushVersion();
  }, [gear, pushVersion]);

  // Scroll ONLY the panel, and only as far as needed: a note below the fold
  // rises to sit at the bottom edge; one above the fold drops to the top
  // edge; a fully visible note doesn't move at all.
  const scrollGutterToNote = useCallback((noteId: string) => {
    // Measure AFTER the card has re-rendered (selection expands it), so the
    // expanded height is what gets scrolled into view.
    window.setTimeout(() => {
      const el = noteEls.current.get(noteId);
      const g = gutterRef.current;
      if (!el || !g) return;
      const pad = 12;
      const gr = g.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      if (er.top < gr.top + pad) {
        g.scrollTo({ top: g.scrollTop + (er.top - gr.top) - pad, behavior: 'smooth' });
      } else if (er.bottom > gr.bottom - pad) {
        g.scrollTo({ top: g.scrollTop + (er.bottom - gr.bottom) + pad, behavior: 'smooth' });
      }
    }, 40);
  }, []);

  // Hovering anchored text soft-highlights its signal card (no scrolling).
  const onHoverAt = useCallback((paraId: string, offset: number | null) => {
    let next: string | null = null;
    if (offset !== null) {
      const { marks, suggestions } = stateRef.current.ai;
      const hitMark = marks.find(
        (m) =>
          m.state !== 'queued' &&
          m.anchor.paraId === paraId &&
          offset >= m.anchor.start &&
          offset <= m.anchor.end
      );
      const hitSug = hitMark
        ? undefined
        : suggestions.find(
            (s) =>
              s.state === 'pending' &&
              s.anchor.paraId === paraId &&
              offset >= s.anchor.start &&
              offset <= s.anchor.end
          );
      next = hitMark?.id ?? hitSug?.id ?? null;
    }
    setHoveredId((prev) => (prev === next ? prev : next));
  }, []);

  // Open the decision popover over a suggestion's anchored text. The margin
  // card is the preview; accept/reject/refine happen here, in the document.
  const openSugPopover = useCallback(
    (sugId: string, opts?: { focus?: boolean; scrollDoc?: boolean }) => {
      const sug = stateRef.current.ai.suggestions.find(
        (s) => s.id === sugId && s.state === 'pending'
      );
      if (!sug) return;
      const el = editorEls.current.get(sug.anchor.paraId);
      if (!el) return;
      if (opts?.scrollDoc) el.scrollIntoView({ block: 'center' });
      const rects = rectsForRange(el, sug.anchor.start, sug.anchor.end);
      if (rects.length === 0) return;
      const first = rects[0];
      const last = rects[rects.length - 1];
      const above = window.innerHeight - last.bottom < 220;
      setSugPopover({
        sugId,
        x: Math.max(12, Math.min(above ? first.left : last.left, window.innerWidth - 400)),
        y: above ? first.top - 8 : last.bottom + 8,
        above,
        autoFocus: !!opts?.focus,
      });
      setHighlightedSugId(sugId);
      setMarkPopover(null);
      setExpandedSugId(null); // switching suggestions closes the previous one
      setDrawerFor(null); // one popover at a time
      const openMark = stateRef.current.ai.marks.find((m) => m.state === 'open');
      if (openMark) dispatch({ type: 'user/closeMark', id: openMark.id });
      scrollGutterToNote(sugId);
    },
    [scrollGutterToNote]
  );

  const closeSugPopover = useCallback(() => {
    setSugPopover(null);
    setHighlightedSugId(null);
  }, []);

  // Keep the popover pinned to its text while the page scrolls or resizes.
  useEffect(() => {
    if (!sugPopover) return;
    const re = () =>
      openSugPopover(sugPopover.sugId, { focus: false });
    window.addEventListener('scroll', re, { passive: true });
    window.addEventListener('resize', re);
    return () => {
      window.removeEventListener('scroll', re);
      window.removeEventListener('resize', re);
    };
  }, [sugPopover?.sugId, openSugPopover]);

  // If the suggestion resolves (or its anchor dies), the popover goes with it.
  useEffect(() => {
    if (
      sugPopover &&
      !state.ai.suggestions.some((s) => s.id === sugPopover.sugId && s.state === 'pending')
    ) {
      closeSugPopover();
    }
  }, [state.ai.suggestions, sugPopover, closeSugPopover]);

  /* ---------- demo ---------- */

  const demo = useDemo({
    dispatch: appDispatch,
    notifyTyping,
    setGear,
    editorEls,
    noteEls,
    stateRef,
    scrollGutterToNote,
    openSugPopover,
  });

  /* ---------- history mode ---------- */

  const openHistory = useCallback(() => {
    pushVersion();
    setCmdk(null);
    setSugPopover(null);
    setDrawerFor(null);
    setSelectedVersionId(null); // defaults to latest
    setHistoryOpen(true);
  }, [pushVersion]);

  const restoreVersion = useCallback(
    (id: number) => {
      setVersions((prev) => {
        const v = prev.find((x) => x.id === id);
        if (v) {
          appDispatch({ type: 'user/restoreVersion', title: v.title, paras: v.paras });
        }
        return prev;
      });
      pushVersion(id);
      setHistoryOpen(false);
      setGear('review');
    },
    [pushVersion]
  );

  /* ---------- the line (⌘K) ---------- */

  const openCmdline = useCallback(() => {
    // one popover at a time
    setSugPopover(null);
    setHighlightedSugId(null);
    setDrawerFor(null);
    const openMark = stateRef.current.ai.marks.find((m) => m.state === 'open');
    if (openMark) dispatch({ type: 'user/closeMark', id: openMark.id });
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const container =
      range.startContainer instanceof HTMLElement
        ? range.startContainer
        : range.startContainer.parentElement;
    const editorEl = container?.closest<HTMLElement>('[data-editor]');
    if (!editorEl) return;
    const paraId = editorEl.getAttribute('data-editor')!;
    const offs = selectionOffsets(editorEl);
    if (!offs) return;
    const rect = range.getBoundingClientRect();
    setCmdk({
      anchor: { paraId, start: offs.start, end: offs.end },
      x: Math.max(12, Math.min(rect.left, window.innerWidth - 372)),
      y: rect.bottom + 8,
    });
  }, []);

  const submitCmdline = useCallback(() => {
    const current = cmdkRef.current;
    if (!current) return;
    const { anchor } = current;
    setCmdk(null);
    setShimmer(anchor); // ~800ms shimmer on the selection…
    window.setTimeout(() => {
      setShimmer(null);
      const para = stateRef.current.doc.paras.find((p) => p.id === anchor.paraId);
      if (!para) return;
      const pick = CMDK_POOL[poolIdx.current++ % CMDK_POOL.length];
      // …then a suggestion appears in the margin, anchored to it. The AI
      // action carries a proposal object only — it cannot touch the doc.
      dispatch({
        type: 'ai/addSuggestion',
        suggestion: {
          id: `s-cmdk-${Date.now()}`,
          anchor,
          state: 'queued',
          originalText: para.text.slice(anchor.start, anchor.end),
          proposedText: pick.proposedText,
          rationale: pick.rationale,
          refined: pick.refined,
          refineCount: 0,
        },
      });
      setGear('review'); // the user summoned this — attention is on review
    }, 800);
  }, []);

  /* ---------- the ask bar (first-class prompting, never a chat) ---------- */

  // Capture the live selection on mousedown, before focusing the bar kills it.
  const armAskSelection = useCallback(() => {
    const sel = window.getSelection();
    let anchor: Anchor | null = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const r = sel.getRangeAt(0);
      const container =
        r.startContainer instanceof HTMLElement
          ? r.startContainer
          : r.startContainer.parentElement;
      const editorEl = container?.closest<HTMLElement>('[data-editor]');
      if (editorEl) {
        const offs = selectionOffsets(editorEl);
        if (offs) {
          anchor = { paraId: editorEl.getAttribute('data-editor')!, start: offs.start, end: offs.end };
        }
      }
    }
    armedSelection.current = anchor;
    setAskHasSelection(anchor !== null);
  }, []);

  const submitAsk = useCallback(
    (_query: string) => {
      const anchor = armedSelection.current;
      armedSelection.current = null;
      setAskHasSelection(false);
      setAskThinking(true);
      if (anchor) {
        // Selection ask: same contract as ⌘K — shimmer, then an anchored suggestion.
        setShimmer(anchor);
        window.setTimeout(() => {
          setShimmer(null);
          setAskThinking(false);
          const para = stateRef.current.doc.paras.find((p) => p.id === anchor.paraId);
          if (!para) return;
          const pick = CMDK_POOL[poolIdx.current++ % CMDK_POOL.length];
          dispatch({
            type: 'ai/addSuggestion',
            suggestion: {
              id: `s-ask-${Date.now()}`,
              anchor,
              state: 'queued',
              originalText: para.text.slice(anchor.start, anchor.end),
              proposedText: pick.proposedText,
              rationale: pick.rationale,
              refined: pick.refined,
              refineCount: 0,
            },
          });
          setGear('review');
        }, 800);
        return;
      }
      // Doc-level ask: the answer lands as an anchored signal in the margin.
      window.setTimeout(() => {
        setAskThinking(false);
        const pick = DOC_ASK_POOL[askPoolIdx.current++ % DOC_ASK_POOL.length];
        const para = stateRef.current.doc.paras.find((p) => p.id === pick.paraId);
        if (!para) return;
        const m = docAskMark(pick, para.text);
        dispatch({ type: 'ai/addMark', mark: m });
        setGear('review');
        window.setTimeout(() => {
          dispatch({ type: 'user/openMark', id: m.id });
          scrollGutterToNote(m.id);
        }, 350);
      }, 700);
    },
    [scrollGutterToNote]
  );

  /* ---------- global keys ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCmdline();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        // small inputs (reply/refine/ask) keep native undo
        if (e.target instanceof HTMLInputElement) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === 'Escape') {
        if (historyOpenRef.current) {
          setHistoryOpen(false);
          return;
        }
        if (cmdkRef.current) {
          setCmdk(null);
          return;
        }
        if (sugPopoverRef.current) {
          closeSugPopover();
          return;
        }
        if (markPopoverRef.current) {
          setMarkPopover(null);
          return;
        }
        if (drawerRef.current !== null) {
          setDrawerFor(null);
          return;
        }
        setGear('review'); // manual gear toggle from the doc
        return;
      }
      if ((e.key === 'd' || e.key === 'D') && !isTypingTarget(e.target)) {
        demo.toggle();
        return;
      }
      // While demo mode is armed, space always advances the script (it would
      // otherwise type into the doc between steps).
      if (e.key === ' ' && demo.active && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        void demo.next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openCmdline, closeSugPopover, undo, redo, demo.active, demo.next, demo.toggle]);

  // Only one signal is ever selected: opening a mark closes the suggestion
  // popover and collapses any expanded suggestion card.
  useEffect(() => {
    if (openMarkId) {
      setSugPopover(null);
      setHighlightedSugId(null);
      setExpandedSugId(null);
    }
  }, [openMarkId]);

  // Position a popover over a mark's anchored text — signals open over the
  // text exactly like suggestions do.
  const openMarkPopover = useCallback((markId: string) => {
    const m = stateRef.current.ai.marks.find((x) => x.id === markId && x.state !== 'queued');
    if (!m) return;
    const el = editorEls.current.get(m.anchor.paraId);
    if (!el) return;
    const rects = rectsForRange(el, m.anchor.start, m.anchor.end);
    if (rects.length === 0) return;
    const first = rects[0];
    const last = rects[rects.length - 1];
    const above = window.innerHeight - last.bottom < 200;
    setMarkPopover({
      markId,
      x: Math.max(12, Math.min(above ? first.left : last.left, window.innerWidth - 400)),
      y: above ? first.top - 8 : last.bottom + 8,
      above,
    });
    setSugPopover(null);
    setHighlightedSugId(null);
    setExpandedSugId(null);
    setDrawerFor(null);
  }, []);

  // Keep it pinned while scrolling; close it if the mark goes away.
  useEffect(() => {
    if (!markPopover) return;
    const re = () => openMarkPopover(markPopover.markId);
    window.addEventListener('scroll', re, { passive: true });
    window.addEventListener('resize', re);
    return () => {
      window.removeEventListener('scroll', re);
      window.removeEventListener('resize', re);
    };
  }, [markPopover?.markId, openMarkPopover]);

  useEffect(() => {
    if (
      markPopover &&
      !state.ai.marks.some((m) => m.id === markPopover.markId && m.state !== 'queued')
    ) {
      setMarkPopover(null);
    }
  }, [state.ai.marks, markPopover]);

  // Clicking anywhere outside the text, panel, or an open popover closes
  // everything transient (evidence drill-in, suggestion popover, ask line,
  // mark highlight). Clicks in the editor are handled by onCaretAt.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (!t) return;
      if (t.closest('[data-editor]')) return;
      if (
        t.closest('.gutter') ||
        t.closest('.sug-popover') ||
        t.closest('.cmdline') ||
        t.closest('.fmt-bar') ||
        t.closest('.ask-bar') ||
        t.closest('.evidence-overlay')
      ) {
        return;
      }
      const keepCmdk = t.closest('.ask-btn') !== null;
      setSugPopover(null);
      setMarkPopover(null);
      setHighlightedSugId(null);
      setExpandedSugId(null);
      setDrawerFor(null);
      if (!keepCmdk) setCmdk(null);
      const open = stateRef.current.ai.marks.find((m) => m.state === 'open');
      if (open) dispatch({ type: 'user/closeMark', id: open.id });
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  // Floating format bar over a text selection in the doc (B / I / U).
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        setFmtBar(null);
        return;
      }
      const r = sel.getRangeAt(0);
      const container =
        r.startContainer instanceof HTMLElement
          ? r.startContainer
          : r.startContainer.parentElement;
      if (!container?.closest('[data-editor]')) {
        setFmtBar(null);
        return;
      }
      const rect = r.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setFmtBar(null);
        return;
      }
      setFmtBar((prev) => {
        const x = rect.left + rect.width / 2;
        const y = rect.top;
        return prev && Math.abs(prev.x - x) < 1 && Math.abs(prev.y - y) < 1 ? prev : { x, y };
      });
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  /* ---------- handlers ---------- */

  // Rich input: text + inline format ranges parsed from the DOM. Markdown
  // shortcuts at the start of an empty paragraph switch its block kind:
  // "# " / "## " headings, "- " bullets, "[] " todos.
  const onTyped = useCallback(
    (paraId: string, text: string, formats: FormatRange[]) => {
      const para = stateRef.current.doc.paras.find((p) => p.id === paraId);
      if (para && para.kind === 'p') {
        const m = /^(#{1,2}|[-*]|\[\])\s$/.exec(text);
        if (m) {
          const kind: BlockKind = m[1].startsWith('#')
            ? m[1] === '#'
              ? 'h2'
              : 'h3'
            : m[1] === '[]'
              ? 'todo'
              : 'bullet';
          appDispatch({ type: 'user/setKind', paraId, kind });
          appDispatch({ type: 'user/input', paraId, text: '', formats: [] });
          notifyTyping();
          return;
        }
      }
      appDispatch({ type: 'user/input', paraId, text, formats });
      notifyTyping();
    },
    [notifyTyping]
  );

  // Block-kind buttons in the format bar act on the paragraph that holds
  // the selection; clicking the active kind toggles back to body text.
  const setKindFromSelection = useCallback(
    (kind: BlockKind) => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      const container =
        r.startContainer instanceof HTMLElement
          ? r.startContainer
          : r.startContainer.parentElement;
      const editorEl = container?.closest<HTMLElement>('[data-editor]');
      if (!editorEl) return;
      const paraId = editorEl.getAttribute('data-editor')!;
      const para = stateRef.current.doc.paras.find((p) => p.id === paraId);
      if (!para) return;
      appDispatch({ type: 'user/setKind', paraId, kind: para.kind === kind ? 'p' : kind });
      notifyTyping();
    },
    [notifyTyping]
  );

  const onToggleTodo = useCallback(
    (paraId: string) => {
      appDispatch({ type: 'user/toggleTodo', paraId });
      notifyTyping();
    },
    [notifyTyping]
  );

  // Enter splits the paragraph at the caret; Backspace at offset 0 merges
  // into the previous one. Both are user keystrokes — the only other thing
  // besides accepting a suggestion that may touch document text.
  const onSplit = useCallback(
    (paraId: string, offset: number) => {
      const newParaId = `p-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
      appDispatch({ type: 'user/splitPara', paraId, offset, newParaId });
      pendingFocus.current = { paraId: newParaId, offset: 0 };
      notifyTyping();
    },
    [notifyTyping]
  );

  const onMergeBack = useCallback(
    (paraId: string) => {
      const paras = stateRef.current.doc.paras;
      const idx = paras.findIndex((p) => p.id === paraId);
      if (idx < 0) return;
      // Backspace at the start of a heading/list block first reverts it to
      // body text (standard editor behavior); a second backspace merges.
      if (paras[idx].kind !== 'p') {
        appDispatch({ type: 'user/setKind', paraId, kind: 'p' });
        notifyTyping();
        return;
      }
      if (idx === 0) return;
      const prev = paras[idx - 1];
      appDispatch({ type: 'user/mergePara', paraId });
      pendingFocus.current = { paraId: prev.id, offset: prev.text.length };
      notifyTyping();
    },
    [notifyTyping]
  );

  // Place the caret after a split/merge once the new DOM exists.
  useEffect(() => {
    const pf = pendingFocus.current;
    if (!pf) return;
    const el = editorEls.current.get(pf.paraId);
    if (el) {
      placeCaretAt(el, pf.offset);
      pendingFocus.current = null;
    }
  }, [state.doc.paras]);

  const onTitleChange = useCallback(
    (title: string) => {
      appDispatch({ type: 'user/setTitle', title });
      notifyTyping();
    },
    [notifyTyping]
  );

  const onTitleEnter = useCallback(() => {
    const first = stateRef.current.doc.paras[0];
    if (!first) return;
    const el = editorEls.current.get(first.id);
    if (el) placeCaretAt(el, 0);
  }, []);

  // Clicking inside anchored text lights up the note it belongs to.
  // Highlighting never steals focus — the caret stays where the user put it.
  const onCaretAt = useCallback((paraId: string, offset: number) => {
    const { marks, suggestions } = stateRef.current.ai;
    const hitMark = marks.find(
      (m) =>
        m.state !== 'queued' &&
        m.anchor.paraId === paraId &&
        offset >= m.anchor.start &&
        offset <= m.anchor.end
    );
    if (hitMark) {
      if (hitMark.state !== 'open') dispatch({ type: 'user/openMark', id: hitMark.id });
      setSugPopover(null);
      setHighlightedSugId(null);
      setDrawerFor(null); // leave any evidence drill-in — show the signal itself
      openMarkPopover(hitMark.id); // signals open over the text, like suggestions
      scrollGutterToNote(hitMark.id);
      return;
    }
    const hitSug = suggestions.find(
      (s) =>
        s.state === 'pending' &&
        s.anchor.paraId === paraId &&
        offset >= s.anchor.start &&
        offset <= s.anchor.end
    );
    if (hitSug) {
      const open = marks.find((m) => m.state === 'open');
      if (open) dispatch({ type: 'user/closeMark', id: open.id });
      // No focus steal: the caret stays in the text; the popover offers the actions.
      openSugPopover(hitSug.id);
      return;
    }
    // Clicked plain text: everything settles back down.
    setSugPopover(null);
    setMarkPopover(null);
    setHighlightedSugId(null);
    setExpandedSugId(null);
    setDrawerFor(null);
    const open = marks.find((m) => m.state === 'open');
    if (open) dispatch({ type: 'user/closeMark', id: open.id });
  }, [openSugPopover, openMarkPopover, scrollGutterToNote]);

  const onFocusPara = useCallback((paraId: string) => setActiveParaId(paraId), []);
  const onBlurPara = useCallback(
    (paraId: string) => setActiveParaId((cur) => (cur === paraId ? null : cur)),
    []
  );
  const onEscape = useCallback(() => setGear('review'), []);
  const onWake = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.isContentEditable) active.blur();
    setGear('review');
  }, []);
  const onOpenEvidence = useCallback((mark: Mark) => setDrawerFor(mark.sourceLabel), []);
  const registerEditor = useCallback((paraId: string, el: HTMLDivElement | null) => {
    if (el) editorEls.current.set(paraId, el);
    else editorEls.current.delete(paraId);
  }, []);
  const registerBlock = useCallback((_paraId: string, _el: HTMLElement | null) => {
    // Paragraph elements are no longer needed for note positioning (the
    // insights panel scrolls independently); kept for future use.
  }, []);
  const registerNote = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) noteEls.current.set(id, el);
    else noteEls.current.delete(id);
  }, []);

  // Shared document-order numbering: text badges and sidebar cards match 1:1.
  const numbers = useMemo(() => {
    const map = new Map<string, number>();
    let n = 1;
    for (const p of state.doc.paras) {
      for (const m of state.ai.marks) {
        if (m.anchor.paraId === p.id && m.state !== 'queued') map.set(m.id, n++);
      }
      for (const s of state.ai.suggestions) {
        if (s.anchor.paraId === p.id && s.state === 'pending') map.set(s.id, n++);
      }
    }
    return map;
  }, [state.doc.paras, state.ai.marks, state.ai.suggestions]);

  /* ---------- render ---------- */

  if (historyOpen && versions.length > 0) {
    const latest = [...versions].sort((a, b) => b.at - a.at)[0];
    return (
      <div className="app gear-review">
        <Sidebar />
        <DocList
          activeTitle={state.doc.title}
          activeSnippet={state.doc.paras[0]?.text.slice(0, 42) ?? ''}
        />
        <HistoryView
          versions={versions}
          selectedId={selectedVersionId ?? latest.id}
          onSelect={setSelectedVersionId}
          onBack={() => setHistoryOpen(false)}
          onRestore={restoreVersion}
        />
      </div>
    );
  }

  return (
    <div className={`app gear-${gear}`}>
      <Sidebar />
      <DocList
        activeTitle={state.doc.title}
        activeSnippet={state.doc.paras[0]?.text.slice(0, 42) ?? ''}
      />
      <div className="top-chrome">
        <span className={`gear-ind gear-ind-${gear}`} title="Esc — settle into review">
          {gear === 'review' ? (
            <>
              <span className="gear-check">✓</span> auto-saved
            </>
          ) : (
            <>
              <span className="gear-dot" /> saving…
            </>
          )}
        </span>
        <button className="chrome-btn" title="Version history" onClick={openHistory}>
          <HistoryIcon />
        </button>
        <span className="chrome-btn chrome-shared">
          <SharedIcon /> Shared
        </span>
      </div>

      <main className="doc-shell">
        <div className="doc-layout" ref={layoutRef}>
          <div className="doc-column">
            <header className="doc-head">
              <TitleEditor
                title={state.doc.title}
                onChange={onTitleChange}
                onEnter={onTitleEnter}
                onEscape={onEscape}
              />
            </header>

            {state.doc.paras.map((para, i) => (
              <ParaBlock
                key={para.id}
                para={para}
                marks={state.ai.marks.filter((m) => m.anchor.paraId === para.id)}
                suggestion={state.ai.suggestions.find(
                  (s) => s.anchor.paraId === para.id && s.state === 'pending'
                )}
                shimmer={shimmer && shimmer.paraId === para.id ? shimmer : null}
                asking={cmdk && cmdk.anchor.paraId === para.id ? cmdk.anchor : null}
                hoveredId={hoveredId}
                numbers={numbers}
                isFirst={i === 0}
                onTyped={onTyped}
                onSplit={onSplit}
                onMergeBack={onMergeBack}
                onCaretAt={onCaretAt}
                onHoverAt={onHoverAt}
                onToggleTodo={onToggleTodo}
                onFocusPara={onFocusPara}
                onBlurPara={onBlurPara}
                onEscape={onEscape}
                registerEditor={registerEditor}
                registerBlock={registerBlock}
              />
            ))}
          </div>

        </div>
      </main>

      <Gutter
        paras={state.doc.paras}
        marks={state.ai.marks}
        suggestions={state.ai.suggestions}
        gear={gear}
        highlightedSugId={highlightedSugId}
        hoveredId={hoveredId}
        numbers={numbers}
        expandedSugId={expandedSugId}
        onToggleSug={(id) => {
          setExpandedSugId((cur) => (cur === id ? null : id));
          // one selection anywhere: close any other suggestion's popover too
          if (sugPopoverRef.current && sugPopoverRef.current.sugId !== id) {
            setSugPopover(null);
            setHighlightedSugId(null);
          }
          const open = stateRef.current.ai.marks.find((m) => m.state === 'open');
          if (open) dispatch({ type: 'user/closeMark', id: open.id });
          setMarkPopover(null);
        }}
        onHoverNote={setHoveredId}
        dispatch={appDispatch}
        gutterRef={gutterRef}
        registerNote={registerNote}
        evidenceFor={drawerFor}
        onCloseEvidence={() => setDrawerFor(null)}
        onOpenEvidence={onOpenEvidence}
        onOpenSuggestion={(id) => openSugPopover(id, { focus: true, scrollDoc: true })}
        onWake={onWake}
      />

      {markPopover &&
        (() => {
          const m = state.ai.marks.find((x) => x.id === markPopover.markId);
          return m ? (
            <MarkPopover
              mark={m}
              num={numbers.get(m.id)}
              x={markPopover.x}
              y={markPopover.y}
              above={markPopover.above}
              dispatch={appDispatch}
              onOpenEvidence={onOpenEvidence}
              onClose={() => setMarkPopover(null)}
            />
          ) : null;
        })()}

      {sugPopover &&
        (() => {
          const sug = state.ai.suggestions.find((s) => s.id === sugPopover.sugId);
          return sug ? (
            <SuggestionPopover
              sug={sug}
              x={sugPopover.x}
              y={sugPopover.y}
              above={sugPopover.above}
              autoFocus={sugPopover.autoFocus}
              dispatch={appDispatch}
              onClose={closeSugPopover}
            />
          ) : null;
        })()}

      <AskBar
        hasSelection={askHasSelection}
        thinking={askThinking}
        onArmSelection={armAskSelection}
        onSubmit={submitAsk}
      />

      {fmtBar && !cmdk && (
        <div
          className="fmt-bar"
          style={{ left: fmtBar.x, top: fmtBar.y }}
          onMouseDown={(e) => e.preventDefault()} // keep the selection alive
        >
          <button title="Bold — ⌘B" onClick={() => document.execCommand('bold')}>
            <strong>B</strong>
          </button>
          <button title="Italic — ⌘I" onClick={() => document.execCommand('italic')}>
            <em>I</em>
          </button>
          <button title="Underline — ⌘U" onClick={() => document.execCommand('underline')}>
            <u>U</u>
          </button>
          <button title="Strikethrough" onClick={() => document.execCommand('strikeThrough')}>
            <s>S</s>
          </button>
          <span className="fmt-sep" />
          <button title="Heading 1" className="fmt-h" onClick={() => setKindFromSelection('h2')}>
            H1
          </button>
          <button title="Heading 2" className="fmt-h" onClick={() => setKindFromSelection('h3')}>
            H2
          </button>
          <span className="fmt-sep" />
          <button title="Bullet list" onClick={() => setKindFromSelection('bullet')}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="3" cy="4" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="3" cy="8" r="0.9" fill="currentColor" stroke="none" />
              <circle cx="3" cy="12" r="0.9" fill="currentColor" stroke="none" />
              <path d="M6.5 4h7M6.5 8h7M6.5 12h7" />
            </svg>
          </button>
          <button title="Checklist" onClick={() => setKindFromSelection('todo')}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="m1.8 4 1 1 1.8-2M1.8 10.5l1 1 1.8-2" />
              <path d="M7.5 4h7M7.5 11h7" />
            </svg>
          </button>
          <span className="fmt-sep" />
          <button className="fmt-ask" onClick={openCmdline}>
            <SparkIcon size={14} /> Ask Noctua
          </button>
        </div>
      )}

      {cmdk && (
        <CommandLine x={cmdk.x} y={cmdk.y} onSubmit={submitCmdline} onDismiss={() => setCmdk(null)} />
      )}

      {demo.active && (
        <div className="demo-hud">
          {demo.step < demo.total ? (
            <>
              demo {demo.step + 1}/{demo.total} · <strong>{demo.label}</strong> · space to advance ·
              D to exit
            </>
          ) : (
            <>demo complete · D to exit</>
          )}
        </div>
      )}
    </div>
  );
}
