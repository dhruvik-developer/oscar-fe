import React from 'react';

export function getInitials(name = '') {
  if (!name || typeof name !== 'string') return 'EP';
  const clean = name.trim();
  if (!clean) return 'EP';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getInitialsColor(name = '') {
  const colors = [
    'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    'bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  ];
  let sum = 0;
  for (let i = 0; i < (name || '').length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
}

export function Avatar({ name = '', size = 'sm', className = '', style }) {
  const initials = getInitials(name);
  const colorClass = getInitialsColor(name || '');

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-xs',
    lg: 'w-11 h-11 text-sm font-semibold',
    xl: 'w-14 h-14 text-base font-bold',
  };

  const finalSize = sizeClasses[size] || sizeClasses.sm;

  return (
    <div
      style={style}
      className={`inline-flex items-center justify-center shrink-0 rounded-full font-bold select-none border ${finalSize} ${colorClass} ${className}`}
      title={name || ''}
    >
      {initials}
    </div>
  );
}

export default Avatar;
