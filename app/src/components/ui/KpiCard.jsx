import React from 'react';
import { Users } from 'lucide-react';

// Kept for older imports; KPI cards no longer draw the wave.
export function Wave() {
  return null;
}

// One accent colour per tone. Tints are mixed from it at render time so the
// card reads well on every theme (light, dark, midnight, emerald, oscar).
// `blue` follows the active theme / brand colour.
const tones = {
  blue: 'var(--primary)',
  primary: 'var(--primary)',
  emerald: '#10b981',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  rose: '#f43f5e',
  indigo: '#6366f1',
  sky: '#0ea5e9',
  teal: '#14b8a6',
  orange: '#f97316',
  cyan: '#06b6d4',
  slate: '#64748b',
};

tones.green = tones.emerald;
tones.red = tones.rose;
tones.yellow = tones.amber;
tones.violet = tones.purple;
tones.gray = tones.slate;

const mix = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

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
  const selectedTone = color && !tones[tone] ? color : tone || 'blue';
  const isRawColor = /^(#|rgb|hsl|var\()/.test(String(selectedTone));
  const accent = customIconColor || tones[selectedTone] || (isRawColor ? selectedTone : tones.blue);
  const trendDown = typeof trend === 'string' && trend.trim().startsWith('↓');
  const trendText = trendDown ? trend.trim().slice(1).trim() : trend;
  const cardLabel = label || title || '';
  const secondaryText = sub || subtext || subtitle;
  const iconBg = customIconBg || badgeBg || mix(accent, 13);

  return (
    <article
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`kpi-card group relative min-w-0 overflow-hidden rounded-xl border p-3 sm:p-4 flex flex-col justify-center transition-all duration-200 hover:-translate-y-0.5 ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${className}`}
      style={{ '--kpi-accent': accent }}
    >
      {/* Accent rail */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full"
        style={{ background: accent }}
      />
      {/* Soft corner glow */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-70 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle, ${mix(accent, 16)} 0%, transparent 70%)` }}
      />

      <div className="relative flex items-center gap-2.5 sm:gap-3">
        <span
          className="grid h-10 w-10 sm:h-11 sm:w-11 shrink-0 place-items-center rounded-xl transition-transform duration-200 group-hover:scale-105"
          style={{ background: iconBg, color: accent, boxShadow: `inset 0 0 0 1px ${mix(accent, 18)}` }}
        >
          {Icon ? (
            <Icon size={19} strokeWidth={2.1} aria-hidden="true" />
          ) : symbol ? (
            <span className="text-base font-extrabold">{symbol}</span>
          ) : (
            <Users size={19} strokeWidth={2.1} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: 'var(--text-secondary)' }}
            title={cardLabel}
          >
            {cardLabel}
          </p>
          <div className="mt-0.5 flex items-baseline gap-1 truncate">
            <strong
              className="block truncate text-[clamp(16px,1.2vw+9px,20px)] font-extrabold leading-tight tracking-tight tabular-nums"
              style={{ color: 'var(--text)' }}
            >
              {value}
            </strong>
            {unit && (
              <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>{unit}</span>
            )}
          </div>
          {trend && (
            <p
              className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold"
              style={{ color: trendDown ? 'var(--danger)' : 'var(--success)' }}
            >
              <span className="inline-block">{trendDown ? '↘' : '↗'}</span> {trendText}
            </p>
          )}
          {!trend && secondaryText && (
            <p className="mt-0.5 truncate text-[10.5px] font-medium" style={{ color: 'var(--muted)' }} title={secondaryText}>
              {secondaryText}
            </p>
          )}
          {children}
        </div>
      </div>
    </article>
  );
}
