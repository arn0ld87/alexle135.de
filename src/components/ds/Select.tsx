import React from 'react';

/** Styled native select with brand chevron and focus ring. */
export type SelectOption = string | { value: string; label: string };

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: SelectOption[];
  placeholder?: string;
}

export function Select({
  label,
  options = [],
  placeholder,
  id,
  className = '',
  children,
  ...rest
}: SelectProps) {
  const fid = id || (label ? 's-' + label.replace(/\s+/g, '-').toLowerCase() : undefined);
  return (
    <div className={('axsel-field ' + className).trim()}>
      {label && (
        <label className="axsel-label" htmlFor={fid}>
          {label}
        </label>
      )}
      <div className="axsel-wrap">
        <select id={fid} className="axsel" {...rest}>
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((o) => {
            const val = typeof o === 'string' ? o : o.value;
            const lbl = typeof o === 'string' ? o : o.label;
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            );
          })}
          {children}
        </select>
        <span className="axsel-chev" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
    </div>
  );
}

export default Select;
