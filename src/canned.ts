/** All "AI" content in the prototype is hardcoded here. No models, no API. */

import { AppState, Anchor, BlockKind, Mark, Paragraph, Suggestion } from './types';

const P1 =
  "Signups grew 41% last quarter, but week-4 retention hasn't moved since March. The growth story is intact; the value story isn't.";
const P2 =
  'The biggest activation blocker is onboarding length — users churn before they reach their first report.';
const P3 =
  'To address this we will invest in a comprehensive program of onboarding improvements over the coming quarters.';
const P4 = 'Open questions: pricing impact of ';
const P5 =
  'Activation correlates with connecting a data source in week one. Users who connect Slack or HubSpot in their first session retain at more than twice the baseline.';
const P6 =
  'Pricing experiments from Q2 — the annual discount and usage tiers — moved conversion by less than one point, so we are deprioritizing pricing work this quarter.';
const P7 =
  'Competitive: Cardinal shipped native integrations in May, and two churned accounts named them as their destination.';
const P8 =
  'Team: the integrations pod is two engineers short. Hiring closes mid-August, which puts the Aug 15 date at risk.';
const P9 =
  'We will also refresh onboarding copy and screens as a fast follow once integrations land.';
const P10 =
  'Decision needed by Jul 25: commit the integrations scope to the August release train, or slip to September and protect the hiring plan.';

function anchorFor(paraId: string, paraText: string, phrase: string): Anchor {
  const start = paraText.indexOf(phrase);
  if (start === -1) return { paraId, start: 0, end: paraText.length };
  return { paraId, start, end: start + phrase.length };
}

const mark = (
  id: string,
  kind: Mark['kind'],
  state: Mark['state'],
  anchor: Anchor,
  text: string,
  sourceLabel: string
): Mark => ({ id, kind, state, anchor, text, sourceLabel, thread: [] });

function seedMarks(demoMode: boolean): Mark[] {
  const marks = [
    mark(
      'm-evidence',
      'evidence',
      'dot',
      anchorFor('p2', P2, 'onboarding length'),
      '14 of 22 churn interviews cite missing integrations, not onboarding length.',
      'churn interviews'
    ),
    mark(
      'm-q1',
      'contradiction',
      'queued',
      anchorFor('p1', P1, "week-4 retention hasn't moved since March"),
      'Cohort data shows the plateau began in January, not March.',
      'metrics · retention cohorts'
    ),
    mark(
      'm-p5',
      'evidence',
      'dot',
      anchorFor('p5', P5, 'connect Slack or HubSpot in their first session'),
      'Cohort join: first-session connectors retain 61% vs 26% baseline.',
      'metrics · activation cohorts'
    ),
    mark(
      'm-p6',
      'contradiction',
      'queued',
      anchorFor('p6', P6, 'moved conversion by less than one point'),
      'The usage-tier test ran 11 days — under the 3-week minimum for significance.',
      'experiment log'
    ),
    mark(
      'm-p7',
      'evidence',
      'dot',
      anchorFor('p7', P7, 'two churned accounts named them'),
      "Exit surveys #31 and #37 both name Cardinal's native integrations.",
      'exit surveys'
    ),
    mark(
      'm-p8',
      'question',
      'dot',
      anchorFor('p8', P8, 'Hiring closes mid-August'),
      'Last two pod hires took 9 weeks — does Aug 15 hold if this slips?',
      'recruiting pipeline'
    ),
  ];
  if (!demoMode) {
    marks.push(
      mark(
        'm-q2',
        'question',
        'queued',
        anchorFor('p1', P1, 'The growth story is intact'),
        'Paid mix shifted in June — does 41% hold with organic split out?',
        'growth dashboard'
      )
    );
  }
  return marks;
}

function seedSuggestions(): Suggestion[] {
  return [
    {
      id: 's1',
      state: 'pending',
      anchor: { paraId: 'p3', start: 0, end: P3.length },
      originalText: P3,
      proposedText:
        'Ship the Slack and HubSpot integrations by Aug 15; success is week-4 retention up 5 points.',
      rationale: 'Replaces an open-ended program with a shippable scope and a measurable outcome.',
      refined: {
        proposedText:
          'Ship Slack and HubSpot integrations by Aug 15, starting with the 220 accounts that asked for them; success is week-4 retention up 5 points.',
        rationale: 'Adds the first target cohort.',
      },
      refineUsed: false,
    },
    {
      id: 's2',
      state: 'pending',
      anchor: { paraId: 'p9', start: 0, end: P9.length },
      originalText: P9,
      proposedText:
        'Hold the onboarding refresh until September — churn interviews say onboarding is not the blocker.',
      rationale: 'Frees the pod to protect the Aug 15 integration date.',
      refined: {
        proposedText:
          'Hold the onboarding refresh until September and move its two designers to integration QA for August.',
        rationale: 'Reassigns the freed capacity explicitly.',
      },
      refineUsed: false,
    },
  ];
}

/** In demo mode we seed one fewer queued mark so the demo's contradiction
 *  mark fits inside the visible-marks cap. */
function block(
  id: string,
  text: string,
  kind: BlockKind = 'p',
  extra?: { done?: boolean; bold?: string[] }
): Paragraph {
  const formats = (extra?.bold ?? []).flatMap((phrase) => {
    const start = text.indexOf(phrase);
    return start === -1 ? [] : [{ start, end: start + phrase.length, style: 'b' as const }];
  });
  return { id, text, kind, done: extra?.done ?? false, formats, provenance: null };
}

export function seedState(demoMode: boolean): AppState {
  return {
    doc: {
      title: 'Q3 strategy — activation over acquisition',
      paras: [
        block('p1', P1, 'p', { bold: ['41%'] }),
        block('p2', P2),
        block('p3', P3),
        block('p4', P4),
        block('h-data', 'What we know', 'h2'),
        block('p5', P5),
        block('p6', P6),
        block('p7', P7),
        block('h-risk', 'Risks & timing', 'h2'),
        block('p8', P8),
        block('p9', P9),
        block('p10', P10, 'p', { bold: ['Decision needed by Jul 25'] }),
        block('t1', 'Commit the Aug 15 integrations scope with the pod', 'todo'),
        block('t2', 'Sanity-check the cohort join with the data team', 'todo', { done: true }),
      ],
    },
    ai: {
      marks: seedMarks(demoMode),
      suggestions: seedSuggestions(),
    },
  };
}

/** Fake evidence drawer content — shows marks are wired to data, not style. */
export const EVIDENCE_QUOTES = [
  { quote: '“we left because there was no HubSpot sync”', source: 'churn interview #7' },
  { quote: '“onboarding was fine. it just didn’t connect to anything we use”', source: 'churn interview #11' },
  { quote: '“we needed the numbers in Slack, where the team actually lives”', source: 'churn interview #14' },
  { quote: '“setup took an afternoon. the problem showed up later”', source: 'churn interview #19' },
  { quote: '41 requests for integrations vs 6 for shorter onboarding', source: 'support tickets · Q2' },
];

/** Canned proposals for the ⌘K line, cycled in order. */
export const CMDK_POOL: Array<{
  proposedText: string;
  rationale: string;
  refined: { proposedText: string; rationale: string };
}> = [
  {
    proposedText: 'week-4 retention, flat since January per the cohort data',
    rationale: 'Tightens the claim to what the cohort data supports.',
    refined: {
      proposedText: 'week-4 retention, flat since January (cohorts, n=3,120)',
      rationale: 'Adds the sample so the number can be checked.',
    },
  },
  {
    proposedText: 'the two integrations churned users actually named: Slack and HubSpot',
    rationale: 'Names the specific asks from the interviews.',
    refined: {
      proposedText: 'Slack and HubSpot — named in 14 of 22 churn interviews',
      rationale: 'Puts the count next to the claim.',
    },
  },
  {
    proposedText: 'a measurable activation bar: first report within 48 hours of signup',
    rationale: 'Converts the aspiration into a checkpoint.',
    refined: {
      proposedText: 'first report within 48 hours, tracked weekly from Aug 1',
      rationale: 'Adds cadence and a start date.',
    },
  },
];

/** Canned anchored-thread replies (stretch goal). */
export const CANNED_THREAD_REPLIES = [
  'Pulled from the 22 churn interviews tagged Q2 — 14 name integrations explicitly; none mention onboarding length unprompted.',
  'Slack and HubSpot are named together in 9 of those 14. That pair covers most of the ask.',
];

/* ---------------- demo mode script content ---------------- */

export const DEMO_TYPED =
  'gating integrations behind the Pro tier — churn interviews suggest price is what drives users away.';
export const DEMO_RESUME = ' Park pricing until the integrations ship.';

const DEMO_CLAIM = 'churn interviews suggest price is what drives users away';

export function demoContradictionMark(p4Text: string): Mark {
  const idx = p4Text.indexOf(DEMO_CLAIM);
  const anchor: Anchor =
    idx >= 0
      ? { paraId: 'p4', start: idx, end: idx + DEMO_CLAIM.length }
      : { paraId: 'p4', start: 0, end: p4Text.length };
  return {
    id: 'm-demo',
    kind: 'contradiction',
    state: 'queued',
    anchor,
    text: 'Only 3 of 22 churn interviews mention price. 14 cite missing integrations.',
    sourceLabel: 'churn interviews · synthesis',
    thread: [],
  };
}
