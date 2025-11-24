'use client';

/**
 * User Avatar Component for Phase 8.2 - Invitation System
 *
 * Displays user avatar with badge color and initials.
 */

interface UserAvatarProps {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
};

export function UserAvatar({ name, color = '#6366f1', size = 'md' }: UserAvatarProps) {
  // Get initials from name (first 2 characters if single word, or first letter of first 2 words)
  const getInitials = (name: string): string => {
    if (!name) return '?';

    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  const initials = getInitials(name);

  return (
    <div
      className={`flex items-center justify-center rounded-full font-semibold text-white flex-shrink-0 ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}
