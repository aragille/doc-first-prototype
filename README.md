# Doc-first AI workspace — clickable prototype

A single-page prototype where the document is the only interface and the AI has no surface of its own. All AI behavior is hardcoded — no API calls, no models, no persistence.

## Run

```
npm install
npm run dev
```

Demo mode: open `http://localhost:5173/?demo=1` (or press `D` with the doc unfocused), then press **space** to advance each step. The flow: typing finishes a shaky claim → the writer idles → a contradiction dot fades in → the mark opens → focus moves to the pending suggestion → accepted via Enter → typing resumes.

## Controls

Type anywhere (writing gear: the margin dims to 25%, nothing new appears). Stop for ~4s, scroll away from the caret, or press `Esc` to enter review gear (the margin brightens, queued notes fade in). Marks and suggestions are always-readable notes in a fixed right gutter — no hover required. Clicking a mark note highlights its anchored text; `Evidence` opens the fake drawer. On a focused suggestion note: `Enter` accept, `Backspace` reject, `R` refine. Select text and hit `⌘K` for the line.

## Layout stability

Nothing in the document column ever changes size or position because of AI activity. Notes are absolutely positioned in the margin gutter; anchors are tints painted behind the text; gear transitions are opacity-only. Geometry changes only from user actions (typing, accepting a proposal, dismissing a note).

## Where the invariants live

**The AI cannot write to the document — structural, not stylistic.** In `src/reducer.ts`, AI/system actions route to `annotationReducer(ai: AiState, action) => AiState`. It never receives the document, so no AI code path *can* touch text. Document text is mutated in exactly two places, both in `userReducer`: `user/input` (keystrokes) and `user/acceptSuggestion`. Grep test: `doc` appears only inside `userReducer`.

**Every AI object is anchored.** `Mark` and `Suggestion` both require an `Anchor { paraId, start, end }` (`src/types.ts`). There is no chat pane, sidebar, or global panel in the layout for anything unanchored to land in.

**A suggestion cannot exceed its anchor.** Acceptance splices `[start, end)` of one paragraph only (`user/acceptSuggestion`).

**Marks live in the margin, always readable.** Queued marks render nothing; visible marks render as compact notes in the gutter with their text shown (no hover-gating). Clicking one lights up its anchor in the document.

**Nothing materializes in the active paragraph.** New AI objects always enter `queued`. `sys/materialize` promotes them only in review gear, skips the paragraph holding the caret, and respects the 3-visible-marks cap.

**Presence follows attention.** The gear machine (`App.tsx`): typing → writing gear; ~4s idle, scroll-away, or Esc → review gear. Transitions are 200ms opacity only.

One rendering note: paragraph decorations (provenance tint, anchor highlight, ⌘K shimmer) are painted as rects *behind* plain contenteditable text, so the tint can clear mid-keystroke without disturbing the caret.

## Acceptance checklist

- Grep test — no AI code path mutates document text: see `src/reducer.ts` header comment
- Typing suppresses new marks/suggestions on that paragraph; they surface ~150ms after review gear engages (which follows ~4s idle)
- All marks are dots with zero visible text until hover/click
- Accept / reject / refine work via keyboard alone on a focused suggestion
- Provenance tint clears on the first human edit inside it (`adjustRange` overlap → null)
- Demo mode never renders a chat surface — none exists in the codebase
