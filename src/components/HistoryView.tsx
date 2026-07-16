import { diffBounds } from '../text';
import { ParaSnapshot } from '../types';

/** A point-in-time snapshot of the document. Created on load, on idle
 *  checkpoints, on accepted suggestions, and on restores. */
export interface VersionSnap {
  id: number;
  at: number;
  title: string;
  paras: ParaSnapshot[];
  restoredFrom?: number;
}

interface Props {
  versions: VersionSnap[]; // chronological
  selectedId: number;
  onSelect: (id: number) => void;
  onBack: () => void;
  onRestore: (id: number) => void;
}

/** Version history, styled after the Notes history view: doc with a diff
 *  against the previous version, versions rail on the right, restore on top. */
export function HistoryView({ versions, selectedId, onSelect, onBack, onRestore }: Props) {
  const newestFirst = [...versions].sort((a, b) => b.at - a.at);
  const chrono = [...versions].sort((a, b) => a.at - b.at);
  const selected = versions.find((v) => v.id === selectedId) ?? newestFirst[0];
  const idx = chrono.findIndex((v) => v.id === selected.id);
  const prev = idx > 0 ? chrono[idx - 1] : null;

  const groups: Array<{ label: string; items: VersionSnap[] }> = [];
  for (const v of newestFirst) {
    const label = new Date(v.at)
      .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      .toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(v);
    else groups.push({ label, items: [v] });
  }

  const prevMap = new Map((prev?.paras ?? []).map((p) => [p.id, p.text]));
  const selIds = new Set(selected.paras.map((p) => p.id));
  const removed = prev ? prev.paras.filter((p) => !selIds.has(p.id)) : [];

  return (
    <div className="hv">
      <div className="hv-bar">
        <button className="hv-back" onClick={onBack}>
          ← Back to editing
        </button>
        <span className="hv-title">Version history</span>
        <button className="hv-restore" onClick={() => onRestore(selected.id)}>
          Restore this version
        </button>
      </div>
      <div className="hv-body">
        <div className="hv-doc">
          <h1 className="hv-doc-title">{selected.title}</h1>
          {selected.paras.map((p) => (
            <ParaDiff
              key={p.id}
              kind={p.kind}
              prevText={prev ? prevMap.get(p.id) ?? null : p.text}
              text={p.text}
            />
          ))}
          {removed.map((p) => (
            <p key={p.id} className="hv-para">
              <del>{p.text}</del>
            </p>
          ))}
        </div>
        <aside className="hv-rail">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="hv-date">{g.label}</div>
              {g.items.map((v) => (
                <div
                  key={v.id}
                  className={`hv-card ${v.id === selected.id ? 'sel' : ''}`}
                  onClick={() => onSelect(v.id)}
                >
                  <div className="hv-card-head">
                    <span className="hv-time">
                      {new Date(v.at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    {v.restoredFrom !== undefined && (
                      <span className="hv-chip">Restored from #{v.restoredFrom}</span>
                    )}
                    <span className="hv-dots">···</span>
                  </div>
                  <p className="hv-snippet">
                    {v.title} {v.paras[0]?.text ?? ''}
                  </p>
                  <span className="hv-avatar">AL</span>
                </div>
              ))}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

/** Paragraph rendered as a diff against its previous version: additions
 *  green, removals red and struck — like the reference UI. */
function ParaDiff({
  kind,
  prevText,
  text,
}: {
  kind: ParaSnapshot['kind'];
  prevText: string | null;
  text: string;
}) {
  const cls = `hv-para hv-kind-${kind}`;
  if (prevText === null) {
    return (
      <p className={cls}>
        <ins>{text}</ins>
      </p>
    );
  }
  if (prevText === text) return <p className={cls}>{text}</p>;
  const d = diffBounds(prevText, text);
  return (
    <p className={cls}>
      {text.slice(0, d.start)}
      {d.start < d.oldEnd && <del>{prevText.slice(d.start, d.oldEnd)}</del>}
      {d.start < d.newEnd && <ins>{text.slice(d.start, d.newEnd)}</ins>}
      {text.slice(d.newEnd)}
    </p>
  );
}
