import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Anchor, Gear, Mark } from './types';
import { Action, rootReducer } from './reducer';
import { CMDK_POOL, seedState } from './canned';
import { placeCaretAt, placeCaretAtEnd, rectsForRange, selectionOffsets } from './text';
import { SuggestionPopover } from './components/SuggestionPopover';
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
import { EvidenceDrawer } from './components/EvidenceDrawer';
import { CommandLine } from './components/CommandLine';
import { TitleEditor } from './components/TitleEditor';
import { Sidebar } from './components/Sidebar';
import { DocList } from './components/DocList';
import { useDemo } from './demo';

const IDLE_MS = 4000; // writing → review after ~4s of stillness
const MAX_VISIBLE_MARKS = 6; // hard cap; extras queue

function agoLabel(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

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
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const [cmdk, setCmdk] = useState<{ anchor: Anchor; x: number; y: number } | null>(null);
  const [shimmer, setShimmer] = useState<Anchor | null>(null);
  const [highlightedSugId, setHighlightedSugId] = useState<string | null>(null);
  const [sugPopover, setSugPopover] = useState<{
    sugId: string;
    x: number;
    y: number;
    above: boolean;
    autoFocus: boolean;
  } | null>(null);
  const sugPopoverRef = useRef(sugPopover);
  sugPopoverRef.current = sugPopover;

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
    const paras = stateRef.current.doc.paras.map((p) => ({ id: p.id, text: p.text }));
    setVersions([
      { id: 1, at: now - 2 * 86400_000 - 3_600_000, title, paras: paras.slice(0, 4) },
      { id: 2, at: now - 86400_000 - 7_200_000, title, paras: paras.slice(0, 7) },
      { id: 3, at: now - 3 * 3_600_000, title, paras },
    ]);
  }, []);

  // Snapshot the doc (skips if nothing changed since the last version).
  const pushVersion = useCallback((restoredFrom?: number) => {
    window.setTimeout(() => {
      const title = stateRef.current.doc.title;
      const paras = stateRef.current.doc.paras.map((p) => ({ id: p.id, text: p.text }));
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

  // Accepting a suggestion is a real revision — it lands in version history.
  // (The doc itself keeps no trace: the green tint fades fully away.)
  const appDispatch = useCallback(
    (action: Action) => {
      dispatch(action);
      if (action.type === 'user/acceptSuggestion') pushVersion();
    },
    [pushVersion]
  );
  const [lastEditAt, setLastEditAt] = useState(() => Date.now() - 2 * 60_000);
  const [, setTick] = useState(0);

  const editorEls = useRef(new Map<string, HTMLDivElement>());
  const pendingFocus = useRef<{ paraId: string; offset: number } | null>(null);
  const noteEls = useRef(new Map<string, HTMLDivElement>());
  const gutterRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | undefined>(undefined);
  const poolIdx = useRef(0);
  const cmdkRef = useRef(cmdk);
  cmdkRef.current = cmdk;
  const drawerRef = useRef(drawerFor);
  drawerRef.current = drawerFor;

  /* ---------- gear machine ---------- */

  const notifyTyping = useCallback(() => {
    setLastEditAt(Date.now());
    setGear('writing');
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setGear('review'), IDLE_MS);
  }, []);

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

  // Scroll ONLY the insights panel (never the page) to bring a note into view.
  const scrollGutterToNote = useCallback((noteId: string) => {
    const el = noteEls.current.get(noteId);
    const g = gutterRef.current;
    if (!el || !g) return;
    g.scrollTo({
      top: Math.max(0, el.offsetTop - Math.max(72, g.clientHeight / 3)),
      behavior: 'smooth',
    });
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
          dispatch({ type: 'user/restoreVersion', title: v.title, paras: v.paras });
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
          refineUsed: false,
        },
      });
      setGear('review'); // the user summoned this — attention is on review
    }, 800);
  }, []);

  /* ---------- global keys ---------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openCmdline();
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
  }, [openCmdline, closeSugPopover, demo.active, demo.next, demo.toggle]);

  // "edited Nm ago" ticker
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(t);
  }, []);

  /* ---------- handlers ---------- */

  const onTyped = useCallback(
    (paraId: string, text: string) => {
      dispatch({ type: 'user/input', paraId, text });
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
      dispatch({ type: 'user/splitPara', paraId, offset, newParaId });
      pendingFocus.current = { paraId: newParaId, offset: 0 };
      notifyTyping();
    },
    [notifyTyping]
  );

  const onMergeBack = useCallback(
    (paraId: string) => {
      const paras = stateRef.current.doc.paras;
      const idx = paras.findIndex((p) => p.id === paraId);
      if (idx <= 0) return;
      const prev = paras[idx - 1];
      dispatch({ type: 'user/mergePara', paraId });
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
      dispatch({ type: 'user/setTitle', title });
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
    setHighlightedSugId(null);
    const open = marks.find((m) => m.state === 'open');
    if (open) dispatch({ type: 'user/closeMark', id: open.id });
  }, [openSugPopover, scrollGutterToNote]);

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

  const queuedMarks = state.ai.marks.filter((m) => m.state === 'queued').length;

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
        {queuedMarks > 0 && (
          <span className="chip">
            {queuedMarks} mark{queuedMarks === 1 ? '' : 's'} queued
          </span>
        )}
        <span className={`gear-ind gear-ind-${gear}`} title="Esc — switch to review">
          <span className="gear-dot" />
          {gear}
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
              <div className="doc-meta">draft · edited {agoLabel(lastEditAt)}</div>
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
                isFirst={i === 0}
                onTyped={onTyped}
                onSplit={onSplit}
                onMergeBack={onMergeBack}
                onCaretAt={onCaretAt}
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
        dispatch={dispatch}
        gutterRef={gutterRef}
        registerNote={registerNote}
        onOpenEvidence={onOpenEvidence}
        onOpenSuggestion={(id) => openSugPopover(id, { focus: true, scrollDoc: true })}
        onWake={onWake}
      />

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

      <div className="cmdk-hint">⌘K — ask about selection</div>

      <EvidenceDrawer
        open={drawerFor !== null}
        sourceLabel={drawerFor ?? ''}
        onClose={() => setDrawerFor(null)}
      />

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
