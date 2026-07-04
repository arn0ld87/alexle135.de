import React from 'react';

/** Avatar with image + mono-initials fallback and optional presence dot. */
export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  initials?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'square' | 'round';
  status?: 'online' | 'offline';
}

export function Avatar({
  src,
  alt = '',
  initials,
  size = 'md',
  shape = 'square',
  status,
  className = '',
  ...rest
}: AvatarProps) {
  return (
    <span className={('axav ' + className).trim()} data-size={size} data-shape={shape} {...rest}>
      {src ? <img src={src} alt={alt} /> : <span>{initials}</span>}
      {status && (
        <span
          className="axav-status"
          data-online={status === 'online' ? 'true' : undefined}
          aria-hidden="true"
        />
      )}
    </span>
  );
}

export default Avatar;
