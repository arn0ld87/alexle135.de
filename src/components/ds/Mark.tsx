import React from 'react';

/**
 * The stacked-layers brand mark — three isometric layers + central orange
 * node, echoing "infrastructure layers". Strokes use currentColor.
 */
export interface MarkProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Mark({ size = 34, className = '', style }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={{ flex: 'none', ...style }}
    >
      <path d="M32 13 V51" stroke="currentColor" strokeWidth="1.4" strokeOpacity="0.5" />
      <path
        d="M32 9 L55 20 L32 31 L9 20 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M32 20 L55 31 L32 42 L9 31 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 31 L55 31" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
      <path
        d="M32 31 L55 42 L32 53 L9 42 Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="31" r="4.2" fill="#ff6a00" />
    </svg>
  );
}

/** Brand wordmark: mark + "AlexLE" with clay-toned "135.de". */
export interface WordmarkProps {
  size?: number;
  className?: string;
}

export function Wordmark({ size = 19, className = '' }: WordmarkProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 10, color: 'var(--mono-50)' }}
    >
      <Mark size={size * 1.6} />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 600,
          fontSize: size,
          letterSpacing: '-0.03em',
        }}
      >
        AlexLE<span style={{ color: 'var(--clay-500)' }}>135.de</span>
      </span>
    </span>
  );
}

export default Mark;
