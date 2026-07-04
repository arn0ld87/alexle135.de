import React from 'react';

/** Square icon-only button — always pass a `label` for accessibility. */
export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'ghost' | 'solid' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  label: string;
}

export function IconButton({
  children,
  variant = 'ghost',
  size = 'md',
  label,
  className = '',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={('axib ' + className).trim()}
      data-variant={variant}
      data-size={size}
      aria-label={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export default IconButton;
