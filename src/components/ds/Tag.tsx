import React from 'react';

/** Pill chip for filters, tech-stack labels and removable tokens. */
export interface TagProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'onClick'> {
  icon?: React.ReactNode;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onRemove?: (e: React.MouseEvent) => void;
}

export function Tag({
  children,
  icon = null,
  selected = false,
  onRemove,
  onClick,
  className = '',
  ...rest
}: TagProps) {
  // Kein <button>-Wrapper, wenn onRemove einen inneren <button> rendert —
  // button-in-button ist invalides HTML. Der klickbare span-Fall bekommt
  // stattdessen role/tabIndex/Enter+Space, damit er tastaturbedienbar bleibt.
  const isClickable = !!onClick || selected;
  const interactive = isClickable && !onRemove;
  const TagEl: React.ElementType = interactive ? 'button' : 'span';
  const handleKeyDown =
    !interactive && isClickable && onClick
      ? (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(e as unknown as React.MouseEvent);
          }
        }
      : undefined;
  return (
    <TagEl
      type={interactive ? 'button' : undefined}
      className={('axtag ' + className).trim()}
      data-interactive={isClickable ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
      role={!interactive && isClickable ? 'button' : undefined}
      tabIndex={!interactive && isClickable ? 0 : undefined}
      onKeyDown={handleKeyDown}
      onClick={onClick}
      {...rest}
    >
      {icon}
      {children}
      {onRemove && (
        <button
          type="button"
          className="axtag-x"
          aria-label="Entfernen"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </TagEl>
  );
}

export default Tag;
