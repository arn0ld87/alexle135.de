import React from 'react';

/** Labelled text field with optional icon, hint/error and multiline mode. */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  hint?: string;
  invalid?: boolean;
  mono?: boolean;
  multiline?: boolean;
}

export function Input({
  label,
  icon = null,
  hint,
  invalid = false,
  mono = false,
  multiline = false,
  id,
  className = '',
  ...rest
}: InputProps) {
  const defaultId = React.useId();
  const fid = id || (label ? 'f-' + label.replace(/\s+/g, '-').toLowerCase() : defaultId);
  const hintId = hint ? `${fid}-hint` : undefined;
  const Field: React.ElementType = multiline ? 'textarea' : 'input';
  const fieldProps: Record<string, unknown> = {
    id: fid,
    className: 'axinput',
    'data-hasicon': icon && !multiline ? 'true' : undefined,
    'data-invalid': invalid ? 'true' : undefined,
    'data-mono': mono ? 'true' : undefined,
    'aria-invalid': invalid || undefined,
    'aria-describedby': hintId,
    ...rest,
  };
  return (
    <div className={('axfield ' + className).trim()}>
      {label && (
        <label className="axfield-label" htmlFor={fid}>
          {label}
        </label>
      )}
      <div className="axinput-wrap">
        {icon && !multiline && (
          <span className="axinput-ic" aria-hidden="true">
            {icon}
          </span>
        )}
        <Field {...fieldProps} />
      </div>
      {hint && (
        <span id={hintId} className="axfield-hint" data-invalid={invalid ? 'true' : undefined}>
          {hint}
        </span>
      )}
    </div>
  );
}

export default Input;
