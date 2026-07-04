import React from 'react';

/** The brand surface container — glass panel, optional reticle brackets. */
export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'solid' | 'raised';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  reticle?: boolean;
  as?: React.ElementType;
  href?: string;
}

export function Card({
  children,
  variant = 'default',
  padding = 'md',
  interactive = false,
  reticle = false,
  as = 'div',
  className = '',
  ...rest
}: CardProps) {
  const Tag: React.ElementType = as;
  const props: Record<string, unknown> = {
    className: ('axcard ' + className).trim(),
    'data-variant': variant,
    'data-pad': padding,
    'data-interactive': interactive ? 'true' : undefined,
    'data-reticle': reticle ? 'true' : undefined,
    ...rest,
  };
  return <Tag {...props}>{children}</Tag>;
}

export default Card;
