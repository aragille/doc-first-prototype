import { useMemo } from 'react';
import { Anchor, Mark, Paragraph, Suggestion } from '../types';
import { BadgeSpec, EditablePara, OverlaySpec } from './EditablePara';

interface Props {
  para: Paragraph;
  marks: Mark[];
  suggestion: Suggestion | undefined;
  shimmer: Anchor | null;
  /** Range the ask line is currently attached to — stays visibly selected. */
  asking: Anchor | null;
  /** Signal/suggestion currently hovered (text or note side). */
  hoveredId: string | null;
  /** Document-order numbering shared with the sidebar cards. */
  numbers: Map<string, number>;
  isFirst: boolean;
  onTyped: (paraId: string, text: string, formats: Paragraph['formats']) => void;
  onSplit: (paraId: string, offset: number) => void;
  onMergeBack: (paraId: string) => void;
  onCaretAt: (paraId: string, offset: number) => void;
  onHoverAt: (paraId: string, offset: number | null) => void;
  onToggleTodo: (paraId: string) => void;
  onFocusPara: (paraId: string) => void;
  onBlurPara: (paraId: string) => void;
  onEscape: () => void;
  registerEditor: (paraId: string, el: HTMLDivElement | null) => void;
  registerBlock: (paraId: string, el: HTMLElement | null) => void;
}

/**
 * A paragraph is ALWAYS a plain editable paragraph. AI presence shows up
 * only as soft tints painted behind the text (mark anchors colored by kind,
 * range of a pending suggestion, provenance of accepted text, ⌘K shimmer) —
 * none of which can change the paragraph's size.
 */
export function ParaBlock({
  para,
  marks,
  suggestion,
  shimmer,
  asking,
  hoveredId,
  numbers,
  isFirst,
  onTyped,
  onSplit,
  onMergeBack,
  onCaretAt,
  onHoverAt,
  onToggleTodo,
  onFocusPara,
  onBlurPara,
  onEscape,
  registerEditor,
  registerBlock,
}: Props) {
  const overlays = useMemo<OverlaySpec[]>(() => {
    const list: OverlaySpec[] = [];
    if (para.provenance) {
      list.push({
        key: `prov-${para.provenance.acceptedAt}`,
        className: 'ov-provenance',
        start: para.provenance.start,
        end: para.provenance.end,
      });
    }
    // Anchor tints rest neutral (#F5F5F5) and take their stance color when
    // hovered or selected; the number badge is always stance-colored.
    if (suggestion && suggestion.state === 'pending') {
      list.push({
        key: `sug-${suggestion.id}`,
        className: `ov-anchor st-suggest${hoveredId === suggestion.id ? ' ov-strong' : ''}`,
        start: suggestion.anchor.start,
        end: suggestion.anchor.end,
      });
    }
    for (const m of marks) {
      if (m.state === 'queued') continue;
      list.push({
        key: `mark-${m.id}`,
        className: `ov-anchor st-${m.stance}${m.state === 'open' || m.id === hoveredId ? ' ov-strong' : ''}`,
        start: m.anchor.start,
        end: m.anchor.end,
      });
    }
    if (asking) {
      list.push({ key: 'asking', className: 'ov-asking', start: asking.start, end: asking.end });
    }
    if (shimmer) {
      list.push({ key: 'shimmer', className: 'ov-shimmer', start: shimmer.start, end: shimmer.end });
    }
    return list;
  }, [para.provenance, suggestion, marks, asking, hoveredId, shimmer]);

  // Number badges at the start of each anchored range, colored by stance.
  const badges = useMemo<BadgeSpec[]>(() => {
    const list: BadgeSpec[] = [];
    for (const m of marks) {
      if (m.state === 'queued') continue;
      const n = numbers.get(m.id);
      if (n === undefined) continue;
      list.push({
        key: `badge-${m.id}`,
        className: `badge-${m.stance}`,
        label: `${n}`,
        offset: m.anchor.start,
      });
    }
    if (suggestion && suggestion.state === 'pending') {
      const n = numbers.get(suggestion.id);
      if (n !== undefined) {
        list.push({
          key: `badge-${suggestion.id}`,
          className: 'badge-suggest',
          label: `${n}`,
          offset: suggestion.anchor.start,
        });
      }
    }
    return list;
  }, [marks, suggestion, numbers]);

  return (
    <section
      className={`para-block block-${para.kind} ${
        para.kind === 'todo' && para.done ? 'todo-done' : ''
      }`}
      ref={(el) => registerBlock(para.id, el)}
    >
      {para.kind === 'todo' && (
        <button
          className={`todo-box ${para.done ? 'checked' : ''}`}
          aria-label="Toggle done"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onToggleTodo(para.id)}
        >
          {para.done ? '✓' : ''}
        </button>
      )}
      {para.kind === 'bullet' && <span className="bullet-dot">•</span>}
      <div className="para-body">
        <EditablePara
          para={para}
          overlays={overlays}
          badges={badges}
          isFirst={isFirst}
          onInput={onTyped}
          onSplit={onSplit}
          onMergeBack={onMergeBack}
          onCaretAt={onCaretAt}
          onHoverAt={onHoverAt}
          onFocusPara={onFocusPara}
          onBlurPara={onBlurPara}
          onEscape={onEscape}
          registerEl={registerEditor}
        />
      </div>
    </section>
  );
}
