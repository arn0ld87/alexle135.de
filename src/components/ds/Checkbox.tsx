import React from 'react';

/** Custom checkbox with signal-orange checked fill. */
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Checkbox({
  checked,
  defaultChecked,
  onChange,
  label,
  disabled = false,
  className = '',
  ...rest
}: CheckboxProps) {
  return (
    <label
      className={('axcheck ' + className).trim()}
      data-disabled={disabled ? 'true' : undefined}
    >
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
        {...rest}
      />
      <span className="axcheck-box">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      {label && <span className="axcheck-label">{label}</span>}
    </label>
  );
}

export default Checkbox;
