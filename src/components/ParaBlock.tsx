import { useMemo } from 'react';
import { Anchor, Mark, Paragraph, Suggestion } from '../types';
import { EditablePara, OverlaySpec } from './EditablePara';

interface Props {
  para: Paragraph;
  marks: Mark[];
  suggestion: Suggestion | undefined;
  shimmer: Anchor | null;
  /** Range the ask line is currently attached to — stays visibly selected. */
  asking: Anchor | null;
  isFirst: boolean;
  onTyped: (paraId: string, text: string, formats: Paragraph['formats']) => void;
  onSplit: (paraId: string, offset: number) => void;
  onMergeBack: (paraId: string) => void;
  onCaretAt: (paraId: string, offset: number) => void;
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
  isFirst,
  onTyped,
  onSplit,
  onMergeBack,
  onCaretAt,
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
    if (suggestion && suggestion.state === 'pending') {
      list.push({
        key: `sug-${suggestion.id}`,
        className: 'ov-suggestion',
        start: suggestion.anchor.start,
        end: suggestion.anchor.end,
      });
    }
    // Every visible mark tints its anchored text in its kind color —
    // stronger when its note is focused.
    for (const m of marks) {
      if (m.state === 'queued') continue;
      list.push({
        key: `mark-${m.id}`,
        className: `ov-mark-${m.kind}${m.state === 'open' ? ' ov-open' : ''}`,
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
  }, [para.provenance, suggestion, marks, asking, shimmer]);

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
          isFirst={isFirst}
          onInput={onTyped}
          onSplit={onSplit}
          onMergeBack={onMergeBack}
          onCaretAt={onCaretAt}
          onFocusPara={onFocusPara}
          onBlurPara={onBlurPara}
          onEscape={onEscape}
          registerEl={registerEditor}
        />
      </div>
    </section>
  );
}
