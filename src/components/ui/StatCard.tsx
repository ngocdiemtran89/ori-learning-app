import React from 'react';
import { Card } from './Card';

export interface StatCardProps {
  label?: string;
  title?: string;
  value: string | number;
  target?: string | number;
  unit?: string;
  subtext?: string;
  status?: 'complete' | 'warning' | 'error' | 'neutral' | string;
  statusLabel?: string;
  variant?: string;
  icon?: React.ReactNode | React.ComponentType<any> | any;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  title,
  value,
  target,
  unit,
  subtext,
  status = 'neutral',
  statusLabel,
  icon,
}) => {
  const displayLabel = label || title || '';
  const displayUnit = unit || subtext || '';
  const statusColors = {
    complete: 'bg-emerald-500 text-white',
    warning: 'bg-amber-500 text-white',
    error: 'bg-rose-500 text-white',
    neutral: 'bg-slate-300 text-slate-700',
  };

  const IconComp = typeof icon === 'function' ? (icon as React.ElementType) : null;

  return (
    <Card padding="sm" className="relative flex flex-col justify-between space-y-3 min-h-[100px]">
      <div className="flex items-center justify-between gap-2">
        <span className="type-table-header text-slate-500 font-bold">{displayLabel}</span>
        {icon && (
          <span className="text-slate-400">
            {IconComp ? <IconComp className="w-5 h-5" /> : (icon as React.ReactNode)}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1.5 tabular-nums">
          <span className="text-2xl font-extrabold text-slate-900 leading-none">{value}</span>
          {target !== undefined && (
            <span className="text-xs font-semibold text-slate-400">/ {target}</span>
          )}
          {displayUnit && <span className="text-xs font-medium text-slate-500">{displayUnit}</span>}
        </div>

        {statusLabel && (
          <span
            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              statusColors[status as keyof typeof statusColors] || statusColors.neutral
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>
    </Card>
  );
};
