/**
 * Demo mode: a scripted ~10-second flow for pitching, advanced by spacebar.
 * The "typing" steps puppeteer the *user* side (they dispatch user actions);
 * the AI side still only ever adds marks/suggestions. No chat surface exists
 * anywhere for it to appear in.
 */

import { Dispatch, MutableRefObject, useCallback, useRef, useState } from 'react';
import { Action } from './reducer';
import { AppState, Gear } from './types';
import { DEMO_RESUME, DEMO_TYPED, demoContradictionMark } from './canned';

export interface DemoCtx {
  dispatch: Dispatch<Action>;
  notifyTyping: () => void;
  setGear: (g: Gear) => void;
  editorEls: MutableRefObject<Map<string, HTMLDivElement>>;
  noteEls: MutableRefObject<Map<string, HTMLDivElement>>;
  stateRef: MutableRefObject<AppState>;
  scrollGutterToNote: (noteId: string) => void;
  openSugPopover: (sugId: string, opts?: { focus?: boolean; scrollDoc?: boolean }) => void;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

async function typeInto(ctx: DemoCtx, paraId: string, addition: string, cps = 32): Promise<void> {
  const el = ctx.editorEls.current.get(paraId);
  el?.focus();
  let text = ctx.stateRef.current.doc.paras.find((p) => p.id === paraId)?.text ?? '';
  for (const ch of addition) {
    text += ch;
    ctx.dispatch({ type: 'user/input', paraId, text });
    ctx.notifyTyping();
    await sleep(1000 / cps);
  }
}

interface DemoStep {
  label: string;
  run: (ctx: DemoCtx) => Promise<void>;
}

const STEPS: DemoStep[] = [
  {
    label: 'typing finishes the sentence — a shaky claim',
    run: (ctx) => typeInto(ctx, 'p4', DEMO_TYPED),
  },
  {
    label: 'the writer pauses — a dot fades in',
    run: async (ctx) => {
      ctx.editorEls.current.get('p4')?.blur();
      await sleep(350);
      const p4 = ctx.stateRef.current.doc.paras.find((p) => p.id === 'p4');
      if (p4) ctx.dispatch({ type: 'ai/addMark', mark: demoContradictionMark(p4.text) });
      ctx.setGear('review');
      await sleep(600);
    },
  },
  {
    label: 'the mark opens — contradicting evidence',
    run: async (ctx) => {
      ctx.dispatch({ type: 'user/openMark', id: 'm-demo' });
      ctx.scrollGutterToNote('m-demo');
      await sleep(300);
    },
  },
  {
    label: 'attention moves to the pending suggestion',
    run: async (ctx) => {
      ctx.dispatch({ type: 'user/closeMark', id: 'm-demo' });
      await sleep(200);
      ctx.openSugPopover('s1', { focus: true, scrollDoc: true });
      await sleep(300);
    },
  },
  {
    label: 'accepted with Enter — the doc takes the edit',
    run: async (ctx) => {
      ctx.dispatch({ type: 'user/acceptSuggestion', id: 's1' });
      await sleep(900);
    },
  },
  {
    label: 'typing resumes — the room goes quiet again',
    run: (ctx) => typeInto(ctx, 'p4', DEMO_RESUME),
  },
];

export function useDemo(ctx: DemoCtx) {
  const [active, setActive] = useState<boolean>(
    () => new URLSearchParams(window.location.search).get('demo') === '1'
  );
  const [step, setStep] = useState(0);
  const stepRef = useRef(0);
  const runningRef = useRef(false);

  const next = useCallback(async () => {
    if (runningRef.current || stepRef.current >= STEPS.length) return;
    runningRef.current = true;
    try {
      await STEPS[stepRef.current].run(ctx);
    } finally {
      stepRef.current += 1;
      setStep(stepRef.current);
      runningRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(() => setActive((a) => !a), []);

  return {
    active,
    step,
    total: STEPS.length,
    label: step < STEPS.length ? STEPS[step].label : '',
    next,
    toggle,
  };
}
