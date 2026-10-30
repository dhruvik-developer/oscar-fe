import React from 'react';
import { Users } from 'lucide-react';

// Kept for older imports; KPI cards no longer draw the wave.
export function Wave() {
  return null;
}

// Tones resolve to the active theme's tokens (globals.css), so cards follow
// light / oscar / dark / midnight / emerald and any saved brand colour.
const PRIMARY = 'var(--primary, #1B5FD6)';
const INFO = 'var(--info, #2B9BE8)';
const SUCCESS = 'var(--success, #10b981)';
const WARNING = 'var(--warning, #f59e0b)';
const DANGER = 'var(--danger, #ef4444)';
const MUTED = 'var(--muted, #60708d)';

const tones = {
  blue: PRIMARY,
  primary: PRIMARY,
  indigo: PRIMARY,
  purple: PRIMARY,
  violet: PRIMARY,
  sky: INFO,
  cyan: INFO,
  teal: INFO,
  emerald: SUCCESS,
  green: SUCCESS,
  amber: WARNING,
  yellow: WARNING,
  orange: WARNING,
  rose: DANGER,
  red: DANGER,
  slate: MUTED,
  gray: MUTED,
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

  const tint = isRawColor ? accent : PRIMARY;
  const iconBg = customIconBg || badgeBg || `color-mix(in srgb, ${tint} 12%, transparent)`;
  const iconBorder = `color-mix(in srgb, ${tint} 22%, transparent)`;

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
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-20 transition-opacity duration-200 group-hover:opacity-35"
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
            style={{ color: trendDown ? DANGER : SUCCESS }}
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
