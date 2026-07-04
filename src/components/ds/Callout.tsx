import React from 'react';

/** Inline message block for tips, results and warnings. */
export type CalloutTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger';

export interface CalloutProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  tone?: CalloutTone;
  icon?: React.ReactNode;
}

const ICON_PATHS: Record<CalloutTone, React.ReactNode> = {
  neutral: <path d="M12 16v-4M12 8h.01" />,
  accent: <path d="M12 16v-4M12 8h.01" />,
  success: <path d="M20 6 9 17l-5-5" />,
  warn: (
    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  ),
  danger: (
    <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  ),
};

export function Callout({
  children,
  title,
  tone = 'neutral',
  icon,
  className = '',
  ...rest
}: CalloutProps) {
  const ringed = tone === 'neutral' || tone === 'accent';
  return (
    <div className={('axcallout ' + className).trim()} data-tone={tone} {...rest}>
      <span className="axcallout-ic" aria-hidden="true">
        {icon || (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {ringed ? (
              <>
                <circle cx="12" cy="12" r="9" />
                {ICON_PATHS[tone]}
              </>
            ) : (
              ICON_PATHS[tone]
            )}
          </svg>
        )}
      </span>
      <div className="axcallout-body">
        {title && <div className="axcallout-title">{title}</div>}
        <div className="axcallout-text">{children}</div>
      </div>
    </div>
  );
}

export default Callout;
