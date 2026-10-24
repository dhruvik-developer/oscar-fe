import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Users,
  Filter,
  Clock,
  BarChart3,
  DollarSign,
  Package,
  ShoppingCart,
  FileText,
  ArrowRight,
} from 'lucide-react';
import KpiCard from './KpiCard';

const ICONS = {
  users: Users,
  filter: Filter,
  clock: Clock,
  chart: BarChart3,
  bars: BarChart3,
  dollar: DollarSign,
  package: Package,
  cart: ShoppingCart,
  file: FileText,
};

export function StatCard(props) {
  const rawStat = props.stat || {};
  const label = rawStat.label || props.label || props.title || '';
  const value = rawStat.value ?? props.value ?? '';
  const iconRaw = rawStat.icon || props.icon;
  const tone = rawStat.tone || props.tone || props.color || 'blue';
  const rawTrend = rawStat.trend ?? props.trend ?? rawStat.change ?? props.change;
  const note = rawStat.note || props.note || props.subtitle || props.period || props.subtext || '';

  let trendText = null;
  let isUp = true;

  if (typeof rawTrend === 'string' || typeof rawTrend === 'number') {
    trendText = String(rawTrend);
  } else if (rawTrend && typeof rawTrend === 'object') {
    trendText = rawTrend.text || rawTrend.value || rawTrend.label || '';
    if (rawTrend.positive !== undefined) {
      isUp = Boolean(rawTrend.positive);
    } else if (rawTrend.isPositive !== undefined) {
      isUp = Boolean(rawTrend.isPositive);
    }
  }

  if (props.isPositive !== undefined) {
    isUp = Boolean(props.isPositive);
  } else if (rawStat.isPositive !== undefined) {
    isUp = Boolean(rawStat.isPositive);
  } else if (props.trendDirection) {
    isUp = props.trendDirection !== 'down';
  } else if (rawStat.trendDirection) {
    isUp = rawStat.trendDirection !== 'down';
  }

  const Icon = typeof iconRaw === 'function' ? iconRaw : (ICONS[iconRaw] ?? Users);

  return (
    <KpiCard
      label={label}
      value={value}
      icon={Icon}
      tone={tone}
      trend={trendText ? `${isUp ? '' : '↓ '}${trendText}` : undefined}
      sub={note}
      onClick={props.onClick}
      className={props.className}
      badgeBg={rawStat.badgeBg || props.badgeBg}
      iconColor={rawStat.iconColor || props.iconColor}
    />
  );
}

export function MetricChip({ icon: Icon, label, value, colorScheme = 'blue', onClick }) {
  const schemeColors = {
    rose: { bg: 'rgba(255, 79, 143, 0.08)', border: 'rgba(255, 79, 143, 0.25)', text: '#d92569', iconBg: 'rgba(255, 79, 143, 0.15)', iconFg: '#d92569' },
    emerald: { bg: 'rgba(27, 184, 120, 0.08)', border: 'rgba(27, 184, 120, 0.25)', text: '#0e7c4f', iconBg: 'rgba(27, 184, 120, 0.15)', iconFg: '#0e7c4f' },
    purple: { bg: 'rgba(155, 81, 224, 0.08)', border: 'rgba(155, 81, 224, 0.25)', text: '#732ebd', iconBg: 'rgba(155, 81, 224, 0.15)', iconFg: '#732ebd' },
    amber: { bg: 'rgba(239, 155, 6, 0.08)', border: 'rgba(239, 155, 6, 0.25)', text: '#b87200', iconBg: 'rgba(239, 155, 6, 0.15)', iconFg: '#b87200' },
    blue: { bg: 'rgba(31, 107, 255, 0.08)', border: 'rgba(31, 107, 255, 0.25)', text: '#1550c6', iconBg: 'rgba(31, 107, 255, 0.15)', iconFg: '#1550c6' },
    teal: { bg: 'rgba(12, 177, 172, 0.08)', border: 'rgba(12, 177, 172, 0.25)', text: '#097a76', iconBg: 'rgba(12, 177, 172, 0.15)', iconFg: '#097a76' },
    yellow: { bg: 'rgba(239, 155, 6, 0.08)', border: 'rgba(239, 155, 6, 0.25)', text: '#b87200', iconBg: 'rgba(239, 155, 6, 0.15)', iconFg: '#b87200' },
  };

  const s = schemeColors[colorScheme] || schemeColors.blue;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 transition-all ${
        onClick ? 'cursor-pointer hover:shadow-xs hover:-translate-y-0.5' : ''
      }`}
      style={{ background: s.bg, borderColor: s.border }}
    >
      {Icon && (
        <span
          className="grid h-6 w-6 place-items-center rounded-md text-xs font-bold"
          style={{ background: s.iconBg, color: s.iconFg }}
        >
          <Icon size={13} />
        </span>
      )}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="font-semibold text-slate-500">{label}:</span>
        <strong className="font-bold font-mono" style={{ color: s.text }}>{value}</strong>
      </div>
    </div>
  );
}

export default StatCard;
