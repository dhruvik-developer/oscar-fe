import React from 'react';
import { Users } from 'lucide-react';

// Kept for older imports; KPI cards no longer draw the wave.
export function Wave() {
  return null;
}

const tones = {
  blue: '#2563eb',
  primary: 'var(--primary, #2563eb)',
  emerald: '#059669',
  green: '#059669',
  amber: '#d97706',
  yellow: '#d97706',
  purple: '#6366f1',
  violet: '#6366f1',
  rose: '#e11d48',
  red: '#e11d48',
  indigo: '#4f46e5',
  sky: '#0284c7',
  cyan: '#0284c7',
  teal: '#0d9488',
  orange: '#ea580c',
  slate: '#64748b',
  gray: '#64748b',
};

const toneBg = {
  blue: '#eff6ff',
  primary: 'color-mix(in srgb, var(--primary, #2563eb) 12%, transparent)',
  emerald: '#ecfdf5',
  green: '#ecfdf5',
  amber: '#fffbeb',
  yellow: '#fffbeb',
  purple: '#eef2ff',
  violet: '#eef2ff',
  rose: '#fff1f2',
  red: '#fff1f2',
  indigo: '#eef2ff',
  sky: '#f0f9ff',
  cyan: '#f0f9ff',
  teal: '#f0fdfa',
  orange: '#fff7ed',
  slate: '#f8fafc',
  gray: '#f8fafc',
};

const toneBorder = {
  blue: '#dbeafe',
  primary: 'color-mix(in srgb, var(--primary, #2563eb) 22%, transparent)',
  emerald: '#d1fae5',
  green: '#d1fae5',
  amber: '#fef3c7',
  yellow: '#fef3c7',
  purple: '#e0e7ff',
  violet: '#e0e7ff',
  rose: '#ffe4e6',
  red: '#ffe4e6',
  indigo: '#e0e7ff',
  sky: '#e0f2fe',
  cyan: '#e0f2fe',
  teal: '#ccfbf1',
  orange: '#ffedd5',
  slate: '#e2e8f0',
  gray: '#e2e8f0',
};

export default function KpiCard({
  label,
  title,
  value,
  icon: Icon,
  symbol,
  tone = 'blue',
  color,
  sub,
  subtext,
  subtitle,
  trend,
  unit,
  onClick,
  className = '',
  children,
  badgeBg,
  iconBg: customIconBg,
  iconColor: customIconColor,
}) {
  const normTone = String(color || tone || 'blue').toLowerCase();
  const accent = customIconColor || (color && !tones[normTone] ? color : (tones[normTone] || tones.blue));
  const isRawColor = /^(#|rgb|hsl|var\()/.test(String(accent));

  const iconBg = customIconBg || badgeBg || (toneBg[normTone] || (isRawColor ? `color-mix(in srgb, ${accent} 12%, transparent)` : '#eff6ff'));
  const iconBorder = toneBorder[normTone] || (isRawColor ? `color-mix(in srgb, ${accent} 22%, transparent)` : '#dbeafe');

  const trendDown = typeof trend === 'string' && trend.trim().startsWith('↓');
  const trendText = trendDown ? trend.trim().slice(1).trim() : trend;
  const cardLabel = label || title || '';
  const secondaryText = sub || subtext || subtitle;

  return (
    <article
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`kpi-card group relative min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white p-3.5 sm:p-4 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:border-slate-300 hover:-translate-y-0.5 ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${className}`}
      style={{ '--kpi-accent': accent, minHeight: '106px' }}
    >
      {/* Top 3px accent line */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: accent }}
      />

      {/* Soft radial corner glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-35 transition-opacity duration-200 group-hover:opacity-60"
        style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 70%)` }}
      />

      {/* Top Row: Label on left, Icon badge on right */}
      <div className="relative flex items-center justify-between gap-2">
        <span
          className="text-[11px] font-bold uppercase tracking-wider text-slate-500 truncate"
          title={cardLabel}
        >
          {cardLabel}
        </span>
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-transform duration-200 group-hover:scale-105"
          style={{
            backgroundColor: iconBg,
            color: accent,
            border: `1px solid ${iconBorder}`,
          }}
        >
          {Icon ? (
            <Icon size={18} strokeWidth={2.2} aria-hidden="true" />
          ) : symbol ? (
            <span className="text-base font-extrabold">{symbol}</span>
          ) : (
            <Users size={18} strokeWidth={2.2} />
          )}
        </span>
      </div>

      {/* Bottom Row: Large Number + Subtitle / Trend */}
      <div className="relative mt-2">
        <div className="flex items-baseline gap-1 truncate">
          <strong className="block truncate text-2xl font-bold font-mono tracking-tight text-slate-800 leading-none">
            {value}
          </strong>
          {unit && (
            <span className="text-xs font-semibold text-slate-400">{unit}</span>
          )}
        </div>

        {trend && (
          <p
            className="mt-1 flex items-center gap-1 text-[11px] font-semibold leading-none truncate"
            style={{ color: trendDown ? '#ef4444' : '#10b981' }}
          >
            <span className="inline-block">{trendDown ? '↘' : '↗'}</span> {trendText}
          </p>
        )}

        {!trend && secondaryText && (
          <p
            className="mt-1 text-[11px] font-medium text-slate-400 leading-none truncate"
            title={secondaryText}
          >
            {secondaryText}
          </p>
        )}

        {children}
      </div>
    </article>
  );
}
