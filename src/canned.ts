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
const P11 =
  'Distribution: the partner directory listing went live in June and now drives 9% of new signups at roughly half the CAC of paid channels.';
const P12 =
  'Support load: integration-related tickets doubled quarter over quarter, which the team reads as demand rather than defect.';
const P13 =
  'We will keep the pricing page as is until the integrations ship, and then revisit packaging with real usage data.';
const P14 =
  'Longer term, the bet is that connected workspaces become the default surface for weekly business reviews.';

function anchorFor(paraId: string, paraText: string, phrase: string): Anchor {
  const start = paraText.indexOf(phrase);
  if (start === -1) return { paraId, start: 0, end: paraText.length };
  return { paraId, start, end: start + phrase.length };
}

const mark = (
  id: string,
  kind: Mark['kind'],
  stance: Mark['stance'],
  state: Mark['state'],
  anchor: Anchor,
  text: string,
  sourceLabel: string
): Mark => ({ id, kind, stance, state, anchor, text, sourceLabel, thread: [] });

function seedMarks(demoMode: boolean): Mark[] {
  const marks = [
    mark(
      'm-evidence',
      'evidence',
      'disagrees',
      'dot',
      anchorFor('p2', P2, 'onboarding length'),
      '14 of 22 churn interviews cite missing integrations, not onboarding length.',
      'churn interviews'
    ),
    mark(
      'm-q1',
      'contradiction',
      'disagrees',
      'queued',
      anchorFor('p1', P1, "week-4 retention hasn't moved since March"),
      'Cohort data shows the plateau began in January, not March.',
      'metrics · retention cohorts'
    ),
    mark(
      'm-p5',
      'evidence',
      'agrees',
      'dot',
      anchorFor('p5', P5, 'connect Slack or HubSpot in their first session'),
      'Cohort join: first-session connectors retain 61% vs 26% baseline.',
      'metrics · activation cohorts'
    ),
    mark(
      'm-p6',
      'contradiction',
      'disagrees',
      'queued',
      anchorFor('p6', P6, 'moved conversion by less than one point'),
      'The usage-tier test ran 11 days — under the 3-week minimum for significance.',
      'experiment log'
    ),
    mark(
      'm-p7',
      'evidence',
      'agrees',
      'dot',
      anchorFor('p7', P7, 'two churned accounts named them'),
      "Exit surveys #31 and #37 both name Cardinal's native integrations.",
      'exit surveys'
    ),
    mark(
      'm-p8',
      'question',
      'questions',
      'dot',
      anchorFor('p8', P8, 'Hiring closes mid-August'),
      'Last two pod hires took 9 weeks — does Aug 15 hold if this slips?',
      'recruiting pipeline'
    ),
    mark(
      'm-p10',
      'question',
      'questions',
      'dot',
      anchorFor('p10', P10, 'commit the integrations scope'),
      'Two of three pod leads prefer committing now; one wants the hire signed first.',
      'pod sync notes'
    ),
    mark(
      'm-p11',
      'evidence',
      'agrees',
      'dot',
      anchorFor('p11', P11, 'roughly half the CAC of paid channels'),
      'June cohort confirms: partner-sourced CAC is 47% of paid, with equal week-4 retention.',
      'growth dashboard'
    ),
    mark(
      'm-p12',
      'contradiction',
      'disagrees',
      'queued',
      anchorFor('p12', P12, 'demand rather than defect'),
      'Ticket taxonomy changed in May — part of the doubling is reclassification, not demand.',
      'support ops'
    ),
    mark(
      'm-p14',
      'question',
      'questions',
      'dot',
      anchorFor('p14', P14, 'weekly business reviews'),
      'What is the wedge for weekly reviews — alerts or digests? Interviews don’t say yet.',
      'research backlog'
    ),
  ];
  if (!demoMode) {
    marks.push(
      mark(
        'm-q2',
        'question',
        'questions',
        'queued',
        anchorFor('p1', P1, 'The growth story is intact'),
        'Paid mix shifted in June — does 41% hold with organic split out?',
        'growth dashboard'
      )
    );
  }
  return marks;
}

/** Canned answers for doc-level asks from the ask bar — each lands as an
 *  anchored signal (the AI still only ever creates marks). Cycled in order. */
export const DOC_ASK_POOL: Array<{
  paraId: string;
  phrase: string;
  kind: Mark['kind'];
  stance: Mark['stance'];
  text: string;
  sourceLabel: string;
}> = [
  {
    paraId: 'p10',
    phrase: 'slip to September',
    kind: 'question',
    stance: 'questions',
    text: 'Slipping to September collides with the Cardinal launch window in the competitive brief.',
    sourceLabel: 'competitive brief',
  },
  {
    paraId: 'p5',
    phrase: 'connecting a data source in week one',
    kind: 'evidence',
    stance: 'agrees',
    text: 'Workspaces with a connected source hit first-report in a 1.8-day median.',
    sourceLabel: 'metrics · activation',
  },
  {
    paraId: 'p3',
    phrase: 'Slack and HubSpot integrations',
    kind: 'evidence',
    stance: 'agrees',
    text: 'Integration-first roadmaps beat onboarding polish in 4 of 5 comparable B2B cases.',
    sourceLabel: 'research notes',
  },
];

export function docAskMark(pick: (typeof DOC_ASK_POOL)[number], paraText: string): Mark {
  return mark(
    `m-ask-${Date.now()}`,
    pick.kind,
    pick.stance,
    'queued',
    anchorFor(pick.paraId, paraText, pick.phrase),
    pick.text,
    pick.sourceLabel
  );
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
      refineCount: 0,
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
      refineCount: 0,
    },
    {
      id: 's3',
      state: 'pending',
      anchor: { paraId: 'p13', start: 0, end: P13.length },
      originalText: P13,
      proposedText:
        'Freeze pricing until Sep 30, then revisit packaging with four weeks of integration usage data.',
      rationale: 'Turns "until they ship" into a date and names the data that unlocks it.',
      refined: {
        proposedText:
          'Freeze pricing until Sep 30, then revisit packaging with four weeks of usage data — owner: growth pod.',
        rationale: 'Adds an owner to the revisit.',
      },
      refineCount: 0,
    },
  ];
}

/* Refining is endless: the first refine uses the scripted proposal, then
   canned variants rotate. Old variant endings are stripped first so
   proposals rotate instead of accumulating. */
const REFINE_VARIANTS = [
  { suffix: ' Scope it to the 220 accounts that asked.', rationale: 'Narrows to the highest-signal cohort.' },
  { suffix: ' Measure against the January cohort baseline.', rationale: 'Pins the comparison point.' },
  { suffix: ' Review at the Aug 15 checkpoint.', rationale: 'Adds an explicit decision point.' },
  { suffix: ' Name one owner and a weekly check-in.', rationale: 'Makes it someone’s job.' },
];

export function nextRefinement(s: Suggestion): { proposedText: string; rationale: string } {
  if (s.refineCount === 0 && s.refined) return s.refined;
  let base = s.proposedText;
  for (const v of REFINE_VARIANTS) {
    if (base.endsWith(v.suffix)) base = base.slice(0, -v.suffix.length);
  }
  const idx = (s.refineCount - (s.refined ? 1 : 0)) % REFINE_VARIANTS.length;
  const v = REFINE_VARIANTS[((idx % REFINE_VARIANTS.length) + REFINE_VARIANTS.length) % REFINE_VARIANTS.length];
  return { proposedText: base + v.suffix, rationale: v.rationale };
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
        block('h-dist', 'Distribution & load', 'h2'),
        block('p11', P11),
        block('p12', P12),
        block('p13', P13),
        block('h-long', 'The longer arc', 'h2'),
        block('p14', P14),
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

/** Fake evidence content — rendered like feedback tickets, minimized. */
export interface EvidenceQuote {
  quote: string;
  tag: string;
  tone: 'red' | 'blue';
  ago: string;
  sad: boolean;
}

export const EVIDENCE_QUOTES: EvidenceQuote[] = [
  {
    quote: 'We left because there was no HubSpot sync.',
    tag: 'churn interview #7',
    tone: 'red',
    ago: '12 days ago',
    sad: true,
  },
  {
    quote: 'Onboarding was fine. It just didn’t connect to anything we use.',
    tag: 'churn interview #11',
    tone: 'red',
    ago: '11 days ago',
    sad: true,
  },
  {
    quote: 'We needed the numbers in Slack, where the team actually lives.',
    tag: 'churn interview #14',
    tone: 'red',
    ago: '9 days ago',
    sad: true,
  },
  {
    quote: 'Setup took an afternoon. The problem showed up later.',
    tag: 'churn interview #19',
    tone: 'red',
    ago: '8 days ago',
    sad: false,
  },
  {
    quote: '41 requests for integrations vs 6 for shorter onboarding.',
    tag: 'support tickets · Q2',
    tone: 'blue',
    ago: '7 days ago',
    sad: false,
  },
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
    stance: 'disagrees',
    state: 'queued',
    anchor,
    text: 'Only 3 of 22 churn interviews mention price. 14 cite missing integrations.',
    sourceLabel: 'churn interviews · synthesis',
    thread: [],
  };
}
