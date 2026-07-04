import React from 'react';

/** On/off toggle for settings and feature flags. */
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export function Switch({
  checked,
  defaultChecked,
  onChange,
  label,
  disabled = false,
  className = '',
  ...rest
}: SwitchProps) {
  return (
    <label
      className={('axswitch ' + className).trim()}
      data-disabled={disabled ? 'true' : undefined}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
        {...rest}
      />
      <span className="axswitch-track">
        <span className="axswitch-thumb" />
      </span>
      {label && <span className="axswitch-label">{label}</span>}
    </label>
  );
}

export default Switch;
