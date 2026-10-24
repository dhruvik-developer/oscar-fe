export function MetricCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="kpi-std bg-card border border-border shadow-2xs hover:shadow-xs transition flex items-start min-w-0 overflow-hidden">
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-semibold tracking-[0.04em] uppercase text-muted block truncate">{label}</span>
        <div className="text-[20px] leading-6 font-bold text-text mt-1 truncate">{value}</div>
        {sub && <div className="text-[12px] font-medium text-muted mt-1 truncate">{sub}</div>}
      </div>
      {Icon && (
        <span className="kpi-badge-std shrink-0 bg-soft border border-border flex items-center justify-center text-muted">
          <Icon size={20} />
        </span>
      )}
    </div>
  );
}

