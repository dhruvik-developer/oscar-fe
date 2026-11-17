import React from 'react';
import KpiCard from '../ui/KpiCard';

export function MetricCard({ label, value, sub, icon: Icon, tone, index, ...rest }) {
  return (
    <KpiCard
      label={label}
      value={value}
      sub={sub}
      icon={Icon}
      tone={tone}
      index={index}
      {...rest}
    />
  );
}

export default MetricCard;
