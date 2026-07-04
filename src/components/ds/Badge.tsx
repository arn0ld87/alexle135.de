import React from 'react';

/** Small mono status label for build/deploy states, counts and metadata. */
export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger' | 'info';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
  soft?: boolean;
}

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  soft = false,
  className = '',
  ...rest
}: BadgeProps) {
  return (
    <span
      className={('axbadge ' + className).trim()}
      data-tone={tone}
      data-soft={soft ? 'true' : undefined}
      {...rest}
    >
      {dot && <span className="axbadge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export default Badge;
