import React, { useEffect, useState } from 'react';

interface UserAvatarProps {
  src?: string | null;
  name: string;
  className?: string;
  fallbackClassName?: string;
}

export function normalizeAvatarUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;

  // Rewrite legacy Render or localhost absolute URLs to relative /api/r2/avatar/...
  const match = trimmed.match(/^https?:\/\/[^/]+(\/api\/r2\/avatar\/.+)$/i);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  src,
  name,
  className = 'w-full h-full object-cover',
  fallbackClassName = 'w-full h-full bg-[#1B357B] text-white font-bold text-xs flex items-center justify-center',
}) => {
  const normalizedSrc = normalizeAvatarUrl(src);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [normalizedSrc]);

  if (!normalizedSrc || hasError) {
    const initial = (name || 'U').trim().charAt(0).toUpperCase() || 'U';
    return (
      <div className={fallbackClassName}>
        <span>{initial}</span>
      </div>
    );
  }

  return (
    <img
      src={normalizedSrc}
      alt={name}
      referrerPolicy="no-referrer"
      className={className}
      onError={() => setHasError(true)}
    />
  );
};
