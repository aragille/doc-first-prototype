import { useMemo } from 'react';
import { Anchor, Mark, Paragraph, Suggestion } from '../types';
import { EditablePara, OverlaySpec } from './EditablePara';

interface Props {
  para: Paragraph;
  marks: Mark[];
  suggestion: Suggestion | undefined;
  shimmer: Anchor | null;
  isFirst: boolean;
  onTyped: (paraId: string, text: string) => void;
  onSplit: (paraId: string, offset: number) => void;
  onMergeBack: (paraId: string) => void;
  onCaretAt: (paraId: string, offset: number) => void;
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
  isFirst,
  onTyped,
  onSplit,
  onMergeBack,
  onCaretAt,
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
    if (shimmer) {
      list.push({ key: 'shimmer', className: 'ov-shimmer', start: shimmer.start, end: shimmer.end });
    }
    return list;
  }, [para.provenance, suggestion, marks, shimmer]);

  return (
    <section className="para-block" ref={(el) => registerBlock(para.id, el)}>
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
    </section>
  );
}
