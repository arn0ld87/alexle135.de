import React from 'react';

/** Editorial section header: mono kicker + serif display title + optional aside. */
export interface SectionHeadProps {
  kicker: string;
  title: React.ReactNode;
  id?: string;
  children?: React.ReactNode;
}

export function SectionHead({ kicker, title, id, children }: SectionHeadProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
        marginBottom: 38,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div className="ds-kicker" style={{ marginBottom: 16 }}>
          {kicker}
        </div>
        <h2
          id={id}
          className="ds-serif"
          style={{ fontSize: 'var(--text-display-m)', margin: 0, color: 'var(--text-primary)' }}
        >
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

export default SectionHead;
