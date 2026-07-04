/**
 * AlexLE135 "Warm Noir" design-system components.
 *
 * Token-driven React primitives ported from the Claude Design handoff.
 * All styling lives in `src/styles/warm-noir.css` (global, SSR-safe), so
 * these render during Astro SSR without runtime style injection. Use them
 * inside a `.warm-noir` scope (homepage <main>, design-system showcase).
 */
export { Button } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button';
export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';
export { Badge } from './Badge';
export type { BadgeProps, BadgeTone } from './Badge';
export { Tag } from './Tag';
export type { TagProps } from './Tag';
export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';
export { Card } from './Card';
export type { CardProps } from './Card';
export { Input } from './Input';
export type { InputProps } from './Input';
export { Select } from './Select';
export type { SelectProps, SelectOption } from './Select';
export { Switch } from './Switch';
export type { SwitchProps } from './Switch';
export { Checkbox } from './Checkbox';
export type { CheckboxProps } from './Checkbox';
export { Tabs } from './Tabs';
export type { TabsProps, TabItem } from './Tabs';
export { Callout } from './Callout';
export type { CalloutProps, CalloutTone } from './Callout';
export { Mark, Wordmark } from './Mark';
export type { MarkProps, WordmarkProps } from './Mark';
