import { EVIDENCE_QUOTES } from '../canned';

interface Props {
  open: boolean;
  sourceLabel: string;
  onClose: () => void;
}

/** Fake evidence drawer — static hardcoded quotes. Exists to show that
 *  marks are wired to data, not style. */
export function EvidenceDrawer({ open, sourceLabel, onClose }: Props) {
  return (
    <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="drawer-head">
        <span>Evidence</span>
        <button onClick={onClose}>Close</button>
      </div>
      <p className="drawer-sub">{sourceLabel || 'churn interviews'}</p>
      {EVIDENCE_QUOTES.map((q) => (
        <div className="quote" key={q.source}>
          {q.quote}
          <br />
          <span className="quote-chip">{q.source}</span>
        </div>
      ))}
    </aside>
  );
}
