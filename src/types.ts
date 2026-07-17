export type Gear = 'writing' | 'review';

export type MarkKind = 'evidence' | 'contradiction' | 'question';

/** A reference to a specific range of text inside exactly one paragraph.
 *  Every AI object carries one of these — nothing is free-floating. */
export interface Anchor {
  paraId: string;
  start: number;
  end: number;
}

export interface ThreadMsg {
  id: string;
  author: 'you' | 'margin';
  text: string;
}

export interface Mark {
  id: string;
  anchor: Anchor;
  kind: MarkKind;
  text: string;
  sourceLabel: string;
  /** queued → dot → open. Queued marks render nothing at all. */
  state: 'queued' | 'dot' | 'open';
  thread: ThreadMsg[];
}

export interface Suggestion {
  id: string;
  anchor: Anchor;
  originalText: string;
  proposedText: string;
  rationale: string;
  /** queued → pending. Accepted/rejected suggestions are removed. */
  state: 'queued' | 'pending';
  /** Scripted second proposal used by the first "Refine" (no real AI). */
  refined: { proposedText: string; rationale: string } | null;
  /** How many times this suggestion has been refined — refining is endless;
   *  after the scripted step, canned variants rotate. */
  refineCount: number;
}

/** Faint tint on accepted text. Cleared the moment the user edits inside it. */
export interface Provenance {
  start: number;
  end: number;
  acceptedAt: number;
}

/** Block types: body text, headings, bullets, checklist items. */
export type BlockKind = 'p' | 'h2' | 'h3' | 'bullet' | 'todo';

export type InlineStyle = 'b' | 'i' | 'u' | 's';

/** Inline formatting stored as ranges over the plain text — the text itself
 *  stays plain, so anchors and offsets are unaffected by styling. */
export interface FormatRange {
  start: number;
  end: number;
  style: InlineStyle;
}

export interface Paragraph {
  id: string;
  text: string;
  kind: BlockKind;
  done: boolean; // for todo blocks
  formats: FormatRange[];
  provenance: Provenance | null;
}

/** What a version snapshot stores per paragraph. */
export interface ParaSnapshot {
  id: string;
  text: string;
  kind: BlockKind;
  done: boolean;
  formats: FormatRange[];
}

export interface DocState {
  title: string;
  paras: Paragraph[];
}

/** Everything the AI is allowed to own. Note: no document text in here. */
export interface AiState {
  marks: Mark[];
  suggestions: Suggestion[];
}

export interface AppState {
  doc: DocState;
  ai: AiState;
}
