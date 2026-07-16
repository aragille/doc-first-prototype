import { useRef } from 'react';

/** Workspaces sub-panel: the list of docs, styled like the Notes list.
 *  Only the current workspace is live; the rest are canned. */

interface Props {
  activeTitle: string;
  activeSnippet: string;
}

const SCROLL_SPEED = 45; // px per second — same pace for every title length
const SCROLL_CLEARANCE = 2; // minimal — the fade is lifted while scrolling

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const Search = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" {...stroke}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3.5 3.5" />
  </svg>
);

const Shared = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" {...stroke}>
    <circle cx="6" cy="5.5" r="2.2" />
    <path d="M2 13c.5-2 2.1-3 4-3s3.5 1 4 3" />
    <path d="M10.6 3.8a2.2 2.2 0 0 1 0 3.5M11.8 10.2c1 .4 1.8 1.3 2.2 2.6" />
  </svg>
);

/** List row with a hover-scrolling title (constant speed, stops with the
 *  full title visible clear of the shared icon). */
function DocItem({
  title,
  sub,
  active,
}: {
  title: string;
  sub: string;
  active?: boolean;
}) {
  const outer = useRef<HTMLSpanElement | null>(null);
  const inner = useRef<HTMLSpanElement | null>(null);

  const enter = () => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const dist = i.scrollWidth - o.clientWidth;
    if (dist <= 0) return;
    o.classList.add('scrolling'); // lift the edge fade so the end reads clean
    const travel = dist + SCROLL_CLEARANCE;
    i.style.transitionDuration = `${(travel / SCROLL_SPEED).toFixed(2)}s`;
    i.style.transitionTimingFunction = 'linear';
    i.style.transitionDelay = '0.25s';
    i.style.transform = `translateX(-${travel}px)`;
  };

  const leave = () => {
    const i = inner.current;
    outer.current?.classList.remove('scrolling');
    if (!i) return;
    // snap straight back to the start — no animation
    i.style.transitionDuration = '0s';
    i.style.transitionDelay = '0s';
    i.style.transform = 'translateX(0)';
  };

  return (
    <div
      className={`doclist-item ${active ? 'active' : ''}`}
      onMouseEnter={enter}
      onMouseLeave={leave}
    >
      <div className="doclist-title">
        <span className="doclist-name" ref={outer}>
          <span className="doclist-name-inner" ref={inner}>
            {title}
          </span>
        </span>
        <Shared />
      </div>
      <div className="doclist-sub">{sub}</div>
    </div>
  );
}

const CANNED = [
  {
    group: 'Previous 7 Days',
    items: [
      { title: 'Q2 retro — what churn told us', sub: '2 days ago · 14 of 22 interviews cite missing…' },
      { title: 'Integration launch plan — Slack & HubSpot', sub: '3 days ago · scope, owners, Aug 15 milesto…' },
      { title: 'Pricing experiments — Q2 readout', sub: '5 days ago · usage tiers moved conversion <1pt' },
      { title: 'Competitive brief — Cardinal', sub: '6 days ago · they shipped native integrations…' },
    ],
  },
  {
    group: 'Earlier',
    items: [
      { title: 'H2 product principles', sub: '2 weeks ago · calm software, evidence over vib…' },
      { title: 'Activation metrics — definitions', sub: '3 weeks ago · what counts as a first report' },
    ],
  },
];

export function DocList({ activeTitle, activeSnippet }: Props) {
  return (
    <aside className="doclist">
      <div className="doclist-head">
        <span className="doclist-title-main">Workspaces</span>
        <span className="side-dots">···</span>
        <span className="doclist-plus">+</span>
      </div>

      <div className="doclist-search">
        <Search />
        <span>Search workspaces</span>
      </div>

      <div className="doclist-group">Today</div>
      <DocItem title={activeTitle || 'Untitled'} sub={`just now · ${activeSnippet}`} active />

      {CANNED.map((g) => (
        <div key={g.group}>
          <div className="doclist-group">{g.group}</div>
          {g.items.map((it) => (
            <DocItem key={it.title} title={it.title} sub={it.sub} />
          ))}
        </div>
      ))}
    </aside>
  );
}
