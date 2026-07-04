import React from 'react';

/** Mono-labelled tab bar with a glowing accent underline. */
export type TabItem =
  | string
  | { value: string; label: string; icon?: React.ReactNode; count?: number };

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  items?: TabItem[];
  value?: string;
  onChange?: (value: string) => void;
  block?: boolean;
}

export function Tabs({
  items = [],
  value,
  onChange,
  block = false,
  className = '',
  'aria-label': ariaLabel = 'Filter',
  ...rest
}: TabsProps) {
  return (
    <div
      className={('axtabs ' + className).trim()}
      role="group"
      aria-label={ariaLabel}
      data-block={block ? 'true' : undefined}
      {...rest}
    >
      {items.map((it) => {
        const val = typeof it === 'string' ? it : it.value;
        const label = typeof it === 'string' ? it : it.label;
        const icon = typeof it === 'string' ? null : it.icon;
        const count = typeof it === 'string' ? null : it.count;
        const active = val === value;
        return (
          <button
            key={val}
            type="button"
            aria-pressed={active}
            className="axtab"
            data-active={active ? 'true' : undefined}
            onClick={() => onChange && onChange(val)}
          >
            {icon}
            {label}
            {count != null && <span className="axtab-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
