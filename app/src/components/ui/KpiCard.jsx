import React from 'react';
import { TrendingUp, TrendingDown, Users } from 'lucide-react';

// Kept for backwards compatibility with any legacy imports
export function Wave() {
  return null;
}

/**
 * Universal Pastel Palette Tokens for OSCAR ERP
 * 1. Soft Blue:    #EEF4FF (Border: #D4E2FC, Accent: #2563EB)
 * 2. Soft Green:   #ECF9F0 (Border: #D0F1DB, Accent: #059669)
 * 3. Soft Orange:  #FFF4E8 (Border: #FFE2BF, Accent: #EA580C)
 * 4. Soft Purple:  #F4EEFF (Border: #E2D5FC, Accent: #7C3AED)
 * 5. Soft Pink:    #FFF0F4 (Border: #FDD5DF, Accent: #DB2777)
 * 6. Soft Teal:    #EAF8F6 (Border: #CEF0EB, Accent: #0D9488)
 */
export const KPI_PALETTES = {
  blue: {
    bg: '#EEF4FF',
    border: '#D4E2FC',
    accent: '#2563EB',
    iconBg: 'rgba(37, 99, 235, 0.12)',
    labelColor: '#1E293B',
  },
  green: {
    bg: '#ECF9F0',
    border: '#D0F1DB',
    accent: '#059669',
    iconBg: 'rgba(5, 150, 105, 0.12)',
    labelColor: '#1E293B',
  },
  orange: {
    bg: '#FFF4E8',
    border: '#FFE2BF',
    accent: '#EA580C',
    iconBg: 'rgba(234, 88, 12, 0.12)',
    labelColor: '#1E293B',
  },
  purple: {
    bg: '#F4EEFF',
    border: '#E2D5FC',
    accent: '#7C3AED',
    iconBg: 'rgba(124, 58, 237, 0.12)',
    labelColor: '#1E293B',
  },
  pink: {
    bg: '#FFF0F4',
    border: '#FDD5DF',
    accent: '#DB2777',
    iconBg: 'rgba(219, 39, 119, 0.12)',
    labelColor: '#1E293B',
  },
  teal: {
    bg: '#EAF8F6',
    border: '#CEF0EB',
    accent: '#0D9488',
    iconBg: 'rgba(13, 148, 136, 0.12)',
    labelColor: '#1E293B',
  },
};

// Aliases for compatibility
KPI_PALETTES.amber = KPI_PALETTES.orange;
KPI_PALETTES.yellow = KPI_PALETTES.orange;
KPI_PALETTES.lavender = KPI_PALETTES.purple;
KPI_PALETTES.indigo = KPI_PALETTES.purple;
KPI_PALETTES.emerald = KPI_PALETTES.green;
KPI_PALETTES.rose = KPI_PALETTES.pink;
KPI_PALETTES.cyan = KPI_PALETTES.teal;
KPI_PALETTES.slate = KPI_PALETTES.blue;

export const KPI_SEQUENCE = ['blue', 'green', 'orange', 'purple', 'pink', 'teal'];

export function resolveKpiTone(tone, index) {
  if (typeof index === 'number' && index >= 0) {
    return KPI_SEQUENCE[index % KPI_SEQUENCE.length];
  }
  const key = String(tone || 'blue').toLowerCase().trim();
  if (key.includes('green') || key.includes('emerald') || key.includes('success')) {
    return 'green';
  }
  if (key.includes('orange') || key.includes('amber') || key.includes('yellow') || key.includes('warning')) {
    return 'orange';
  }
  if (key.includes('purple') || key.includes('violet') || key.includes('indigo') || key.includes('lavender')) {
    return 'purple';
  }
  if (key.includes('pink') || key.includes('rose') || key.includes('red') || key.includes('danger')) {
    return 'pink';
  }
  if (key.includes('teal') || key.includes('cyan')) {
    return 'teal';
  }
  if (key.includes('blue') || key.includes('primary') || key.includes('sky') || key.includes('info')) {
    return 'blue';
  }
  return 'blue';
}

/**
 * Helper to parse raw trend / comparison inputs into:
 * - trendText (e.g. "+10.0%", "-5.2%")
 * - isPositive (true | false | null)
 * - comparisonText (e.g. "vs 10", "vs last month")
 */
function parseTrendData(rawTrend, rawPct, rawVs, rawSub, explicitPositive) {
  let trendText = null;
  let isPositive = explicitPositive ?? null;
  let comparisonText = null;

  // Direct pct parameter takes precedence
  if (rawPct !== undefined && rawPct !== null && rawPct !== '') {
    const numPct = Number(rawPct);
    if (!isNaN(numPct)) {
      if (isPositive === null) isPositive = numPct >= 0;
      trendText = `${isPositive ? '+' : ''}${numPct.toFixed(1)}%`;
    } else {
      trendText = String(rawPct);
    }
    if (rawVs) {
      comparisonText = String(rawVs).startsWith('vs') ? String(rawVs) : `vs ${rawVs}`;
    }
    return { trendText, isPositive, comparisonText };
  }

  // Trend as object (e.g. { text: '+5%', isPositive: true, vs: 'last week' })
  if (rawTrend && typeof rawTrend === 'object') {
    trendText = rawTrend.text || rawTrend.value || rawTrend.label || '';
    if (isPositive === null) {
      if (rawTrend.positive !== undefined) isPositive = Boolean(rawTrend.positive);
      else if (rawTrend.isPositive !== undefined) isPositive = Boolean(rawTrend.isPositive);
    }
    comparisonText = rawTrend.vs || rawTrend.comparison || rawTrend.sub || rawTrend.period || null;
    return { trendText, isPositive, comparisonText };
  }

  // Trend as string
  if (rawTrend !== undefined && rawTrend !== null && rawTrend !== '') {
    const str = String(rawTrend).trim();
    if (isPositive === null) {
      if (str.startsWith('↓') || str.startsWith('↘') || str.startsWith('-')) {
        isPositive = false;
      } else if (str.startsWith('↑') || str.startsWith('↗') || str.startsWith('+')) {
        isPositive = true;
      }
    }

    // Strip leading direction indicators for clean parsing
    const clean = str.replace(/^[↓↘↑↗+\-]\s*/, '');

    if (clean.includes(' vs ')) {
      const parts = clean.split(' vs ');
      trendText = (isPositive === true ? '+' : isPositive === false ? '-' : '') + parts[0].trim();
      comparisonText = `vs ${parts.slice(1).join(' vs ').trim()}`;
    } else if (/^[0-9.]+%/.test(clean)) {
      const match = clean.match(/^([0-9.]+%)(.*)$/);
      if (match) {
        trendText = (isPositive === true ? '+' : isPositive === false ? '-' : '') + match[1];
        const rest = match[2].trim();
        if (rest) comparisonText = rest;
      } else {
        trendText = str;
      }
    } else {
      trendText = str;
    }
  }

  if (!comparisonText && rawVs) {
    comparisonText = String(rawVs).startsWith('vs') ? String(rawVs) : `vs ${rawVs}`;
  } else if (!comparisonText && rawSub) {
    comparisonText = rawSub;
  }

  // Clean any leading pipeline separator in comparison text
  if (typeof comparisonText === 'string') {
    comparisonText = comparisonText.replace(/^\|\s*/, '').trim();
  }

  return { trendText, isPositive, comparisonText };
}

/**
 * Smart formatting and dynamic typography for KPI values across OSCAR ERP.
 * - Quantitative metrics (numbers, currency, percentages, ratios) use bold monospaced fonts,
 *   scaling dynamically based on character length so large figures never overflow.
 * - Qualitative/textual labels (e.g. "Annual Review", "Active Cycle", "Processing & Dyeing")
 *   use clean sans-serif typography with multi-line wrapping (line-clamp-2 break-words),
 *   completely preventing words from being chopped with ellipses (...) in any grid or card.
 */
function resolveKpiValueMetrics(val) {
  if (val === null || val === undefined || val === '') {
    return {
      display: '—',
      isText: false,
      sizeClass: 'text-[26px] sm:text-[28px]',
      fontClass: 'font-mono font-black tracking-tight leading-none text-slate-900',
      wrapClass: 'truncate',
    };
  }

  if (typeof val !== 'string' && typeof val !== 'number') {
    return {
      display: val,
      isText: false,
      sizeClass: 'text-[20px]',
      fontClass: 'font-sans font-bold text-slate-900',
      wrapClass: 'min-w-0 break-words',
    };
  }

  const str = String(val).trim();
  if (!str) {
    return {
      display: '—',
      isText: false,
      sizeClass: 'text-[26px] sm:text-[28px]',
      fontClass: 'font-mono font-black tracking-tight leading-none text-slate-900',
      wrapClass: 'truncate',
    };
  }

  // Strip standard metric symbols/units: currency, % and units
  const stripped = str
    .replace(/^[₹$€£]\s*/, '')
    .replace(/\s*(m|kg|pcs|nos|mtrs|k|l|cr|%)\b/gi, '')
    .trim();

  const isFractionOrRatio = /^\d+(\.\d+)?\s*[\/:]\s*\d+(\.\d+)?$/.test(str);
  const hasLetters = /[a-zA-Z]{3,}/.test(stripped);
  const isText = hasLetters && !isFractionOrRatio;
  const len = str.length;

  if (isText) {
    // Textual word values: NEVER cut words with single-line ellipsis!
    let sizeClass = 'text-[17px] sm:text-[18px]';
    if (len <= 8) {
      sizeClass = 'text-[20px] sm:text-[22px]';
    } else if (len <= 14) {
      sizeClass = 'text-[17px] sm:text-[18px]';
    } else if (len <= 20) {
      sizeClass = 'text-[15px] sm:text-[16px]';
    } else {
      sizeClass = 'text-[13.5px] sm:text-[14px]';
    }

    return {
      display: str,
      isText: true,
      sizeClass,
      fontClass: 'font-sans font-bold tracking-tight text-slate-900',
      wrapClass: 'line-clamp-2 break-words leading-snug',
    };
  }

  // Numeric / Quantitative values:
  let sizeClass = 'text-[26px] sm:text-[28px]';
  let wrapClass = 'truncate';

  if (len > 14) {
    sizeClass = 'text-[18px] sm:text-[20px]';
    wrapClass = 'break-all line-clamp-1';
  } else if (len > 10) {
    sizeClass = 'text-[21px] sm:text-[23px]';
    wrapClass = 'truncate';
  } else if (len > 7) {
    sizeClass = 'text-[23px] sm:text-[25px]';
    wrapClass = 'truncate';
  }

  return {
    display: str,
    isText: false,
    sizeClass,
    fontClass: 'font-mono font-black tracking-tight text-slate-900 leading-none',
    wrapClass,
  };
}

/**
 * Standardized Global KPI Card Component for OSCAR ERP
 * 
 * Standard baseline specifications:
 * - Card height: approx 145px (equal-height layout)
 * - Card padding: 16px (p-4)
 * - Border radius: 16px (rounded-2xl)
 * - Card gap: 14px (gap-3.5)
 * - KPI title: 12px font-semibold text-slate-700
 * - KPI value: Dynamic (28px mono for numeric figures, auto-scaled bold sans for textual words)
 * - Comparison text: 11px text-slate-500 font-medium
 * - Trend badge: 11px font-bold
 * - Pastel backgrounds: Soft Blue, Soft Green, Soft Orange, Soft Purple, Soft Pink, Soft Teal
 */
export function KpiCard({
  label,
  title,
  value,
  icon: Icon,
  symbol,
  color,
  tone,
  index,
  paletteIndex,
  variant,
  bg,
  white = false,
  trend,
  change,
  pct,
  vs,
  comparison,
  trendPeriod,
  isPositive,
  trendDirection,
  sub,
  subtext,
  subtitle,
  note,
  period,
  changeLabel,
  unit,
  onClick,
  className = '',
  style = {},
  children,
  badgeBg,
  iconBg: customIconBg,
  iconColor: customIconColor,
  loading = false,
}) {
  const cardIndex = index ?? paletteIndex;
  const toneKey = resolveKpiTone(color || tone, cardIndex);
  const palette = KPI_PALETTES[toneKey] || KPI_PALETTES.blue;

  const isWhite = variant === 'white' || bg === 'white' || white === true;
  const cardBg = isWhite ? '#ffffff' : (bg || palette.bg);
  const cardBorder = isWhite ? '#e2e8f0' : palette.border;

  const cardLabel = label || title || '';
  const secondaryNote = sub || subtext || subtitle || note || period || changeLabel;

  const explicitPositive = isPositive !== undefined ? isPositive : (trendDirection ? trendDirection !== 'down' : undefined);
  const { trendText, isPositive: parsedPositive, comparisonText } = parseTrendData(
    trend ?? change,
    pct,
    vs ?? comparison,
    secondaryNote,
    explicitPositive
  );

  const finalIconBg = customIconBg || badgeBg || palette.iconBg;
  const finalIconColor = customIconColor || palette.accent;

  const hasTrend = Boolean(trendText);
  const valInfo = resolveKpiValueMetrics(value);

  return (
    <article
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`kpi-card relative flex flex-col justify-between overflow-hidden min-w-0 select-none ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
      style={{
        backgroundColor: cardBg,
        borderColor: cardBorder,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '16px',
        padding: '16px',
        height: '145px',
        minHeight: '145px',
        '--kpi-accent': palette.accent,
        ...(style?.boxShadow ? { boxShadow: style.boxShadow } : {}),
        ...style,
      }}
    >
      {/* ── TOP SECTION: Small KPI Title (12px) + Minimal Top-Right Icon ── */}
      <div className="flex items-start justify-between gap-2 leading-tight min-w-0">
        <span
          className="text-[12px] font-semibold text-slate-700 tracking-normal line-clamp-2 break-words min-w-0"
          title={cardLabel}
        >
          {cardLabel}
        </span>

        {(Icon || symbol) && (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200"
            style={{
              backgroundColor: finalIconBg,
              color: finalIconColor,
            }}
            aria-hidden="true"
          >
            {Icon ? (
              <Icon size={15} strokeWidth={2.2} />
            ) : (
              <span className="text-[12px] font-extrabold">{symbol}</span>
            )}
          </span>
        )}
      </div>

      {/* ── MIDDLE SECTION: Large Bold KPI Value (Dynamic Typography) ── */}
      <div className="my-auto py-1 min-h-[44px] flex items-center min-w-0">
        <div className="flex items-baseline gap-1.5 min-w-0 w-full">
          {loading ? (
            <div className="h-7 w-28 bg-slate-200/60 rounded animate-pulse" />
          ) : (
            <strong
              className={`block ${valInfo.wrapClass} ${valInfo.sizeClass} ${valInfo.fontClass}`}
              title={typeof value === 'string' || typeof value === 'number' ? String(value) : undefined}
            >
              {valInfo.display}
            </strong>
          )}
          {unit && !loading && (
            <span className="text-[12px] font-bold text-slate-500 shrink-0">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* ── BOTTOM SECTION: Trend Badge (11px) + Comparison / Note (11px) ── */}
      <div className="flex items-center gap-1.5 min-w-0 text-[11px] leading-tight overflow-hidden">
        {hasTrend ? (
          <>
            <span
              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold text-[11px] shrink-0 ${
                parsedPositive === true
                  ? 'bg-emerald-100/90 text-emerald-800 border border-emerald-200/80'
                  : parsedPositive === false
                  ? 'bg-rose-100/90 text-rose-800 border border-rose-200/80'
                  : 'bg-white/80 text-slate-700 border border-slate-200/80'
              }`}
            >
              {parsedPositive === true && <TrendingUp size={11} strokeWidth={2.5} />}
              {parsedPositive === false && <TrendingDown size={11} strokeWidth={2.5} />}
              <span>{trendText}</span>
            </span>

            {comparisonText && (
              <>
                <span className="text-slate-300 dark:text-slate-500 shrink-0 font-normal">|</span>
                <span
                  className="text-[11px] font-medium text-slate-600 line-clamp-1 break-words min-w-0"
                  title={comparisonText}
                >
                  {comparisonText}
                </span>
              </>
            )}
          </>
        ) : comparisonText ? (
          <span
            className="text-[11px] font-medium text-slate-600 line-clamp-1 break-words min-w-0"
            title={comparisonText}
          >
            {comparisonText}
          </span>
        ) : null}

        {children}
      </div>
    </article>
  );
}

export default KpiCard;
