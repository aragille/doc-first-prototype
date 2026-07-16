/** Static left nav matching the product shell (Noctua). Non-functional —
 *  it situates the doc surface inside the app for the prototype. */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const Eye = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <path d="M1.8 8s2.2-4.2 6.2-4.2S14.2 8 14.2 8 12 12.2 8 12.2 1.8 8 1.8 8z" />
    <circle cx="8" cy="8" r="1.9" />
  </svg>
);

const Layers = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <path d="M8 1.8 14 5 8 8.2 2 5z" />
    <path d="m2 8.2 6 3.2 6-3.2M2 11.2l6 3.2 6-3.2" />
  </svg>
);

const Chat = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <path d="M13.5 9.5a2 2 0 0 1-2 2H6l-3.5 3v-10a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2z" />
  </svg>
);

const Chart = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="3" />
    <path d="M5 10.5v-3M8 10.5v-5M11 10.5v-2" />
  </svg>
);

const People = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <circle cx="6" cy="5.5" r="2.4" />
    <path d="M1.8 13.5c.6-2.2 2.3-3.4 4.2-3.4s3.6 1.2 4.2 3.4" />
    <path d="M10.8 3.6a2.4 2.4 0 0 1 0 3.9M12 10.4c1.1.4 2 1.4 2.4 2.9" />
  </svg>
);

const Gear = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" {...stroke}>
    <circle cx="8" cy="8" r="2.2" />
    <path d="M8 1.8v1.7M8 12.5v1.7M14.2 8h-1.7M3.5 8H1.8M12.4 3.6l-1.2 1.2M4.8 11.2l-1.2 1.2M12.4 12.4l-1.2-1.2M4.8 4.8 3.6 3.6" />
  </svg>
);

const Chevron = () => (
  <svg className="chev" width="14" height="14" viewBox="0 0 16 16" {...stroke}>
    <path d="m4.5 6.5 3.5 3.5 3.5-3.5" />
  </svg>
);

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="side-org">
        <span className="org-avatar">No</span>
        <span className="org-name">Noctua</span>
        <span className="side-dots">⋮</span>
      </div>

      <div className="side-label">Products</div>
      <div className="side-item side-product">
        <Eye />
        <span>Noctua</span>
        <Chevron />
      </div>
      <nav className="side-nav">
        {/* Workspaces is the main entity */}
        <div className="side-item side-active">
          <Layers />
          <span>Workspaces</span>
        </div>
        <div className="side-item">
          <Chat />
          <span>Feedback</span>
        </div>
        <div className="side-item">
          <Chart />
          <span>Sentiment</span>
        </div>
        <div className="side-item">
          <People />
          <span>People</span>
        </div>
        <div className="side-item">
          <Gear />
          <span>Settings</span>
        </div>
      </nav>

      <button className="side-new">+ New product</button>
      <div className="side-spacer" />

      <div className="side-footer">
        <span className="user-avatar">AL</span>
        <div className="user-meta">
          <div className="user-name">Anna Lalayants</div>
          <div className="user-mail">annalalayants.designs@g…</div>
        </div>
        <span className="side-dots">⋮</span>
      </div>
    </aside>
  );
}
