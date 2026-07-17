import { ReactNode } from 'react';

/** Status badge matching the feedback tags. `icon` adds the little bars. */
export function Pill({
  className,
  icon = true,
  children,
}: {
  className: string;
  icon?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`pill ${className}`}>
      {icon && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
          <rect x="0.8" y="6.2" width="2.5" height="5" rx="1.25" opacity="0.5" />
          <rect x="4.7" y="3.6" width="2.5" height="7.6" rx="1.25" opacity="0.75" />
          <rect x="8.6" y="0.8" width="2.5" height="10.4" rx="1.25" />
        </svg>
      )}
      {children}
    </span>
  );
}
