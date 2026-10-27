import React from 'react';
import KpiCard from '../ui/KpiCard';

export function MetricCard({ label, value, sub, icon: Icon, tone = 'blue' }) {
  return (
    <KpiCard
      label={label}
      value={value}
      sub={sub}
      icon={Icon}
      tone={tone}
    />
  );
}

export default MetricCard;
