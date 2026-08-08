import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  variant?: 'sky' | 'emerald' | 'purple' | 'amber';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtext,
  icon: Icon,
  variant = 'sky',
}) => {
  const variantStyles = {
    sky: 'bg-sky-50 text-ori-600 border-sky-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${variantStyles[variant]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-slate-500 truncate">{title}</div>
        <div className="text-lg font-extrabold text-slate-900 tracking-tight mt-0.5">{value}</div>
        {subtext && <div className="text-[11px] text-slate-400 font-medium mt-0.5">{subtext}</div>}
      </div>
    </div>
  );
};
