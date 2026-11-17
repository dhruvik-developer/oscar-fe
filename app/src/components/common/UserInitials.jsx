import React from 'react';
import { User } from 'lucide-react';

const ROLE_BADGE_STYLES = [
  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
  'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800',
];

export function getRoleBadgeStyle(name) {
  const key = String(name || '');
  if (!key) return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return ROLE_BADGE_STYLES[Math.abs(hash) % ROLE_BADGE_STYLES.length];
}

/**
 * The person's initials in a coloured circle, styled like administration users.
 * Supports custom size/typography via className and iconSize for fallback icon.
 */
export default function UserInitials({ name, className = 'w-8 h-8 text-xs', iconSize = 14 }) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  let initials = '';
  if (words.length > 1) {
    initials = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1) {
    initials = (words[0].length >= 2 ? words[0].slice(0, 2) : words[0]).toUpperCase();
  }

  return (
    <div
      aria-hidden="true"
      className={`${className} rounded-full flex items-center justify-center font-bold ring-2 ring-slate-100 dark:ring-slate-800 shadow-xs flex-shrink-0 border select-none ${getRoleBadgeStyle(name)}`}
    >
      {initials || <User size={iconSize} />}
    </div>
  );
}

export { UserInitials };
