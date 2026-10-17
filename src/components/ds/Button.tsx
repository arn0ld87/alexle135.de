import React from 'react';

/**
 * Primäres Bedienelement des Systemwerk-Designs. Das CSS steht global in
 * `src/styles/systemwerk.css` (`.axb`), die Komponente rendert deshalb auch beim
 * Astro-SSR ohne Stil-Injektion. Pro Ansicht genau ein `primary`; `terminal` ist die
 * Variante der Terminal-Insel.
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
