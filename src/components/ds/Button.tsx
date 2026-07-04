import React from 'react';

/**
 * Warm-Noir primary action control. CSS lives globally in
 * `src/styles/warm-noir.css` (`.axb`), so this renders cleanly during
 * Astro SSR without runtime style injection. Use ONE `primary` per view;
 * `terminal` is the signature CLI-flavoured variant.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'terminal' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  href?: string;
  type?: 'button' | 'submit' | 'reset';
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  block = false,
  loading = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  href,
  type = 'button',
  className = '',
  ...rest
}: ButtonProps) {
  const Tag: React.ElementType = href ? 'a' : 'button';
  const props: Record<string, unknown> = {
    className: ('axb ' + className).trim(),
    'data-variant': variant,
    'data-size': size,
    'data-block': block ? 'true' : undefined,
    'data-loading': loading ? 'true' : undefined,
    ...(href ? { href } : { type }),
    ...(disabled
      ? href
        ? { 'aria-disabled': 'true' }
        : { disabled: true, 'aria-disabled': 'true' }
      : {}),
    ...rest,
  };
  return (
    <Tag {...props}>
      {loading && <span className="axb-spin" aria-hidden="true" />}
      {iconLeft}
      {children && <span>{children}</span>}
      {iconRight}
    </Tag>
  );
}

export default Button;
