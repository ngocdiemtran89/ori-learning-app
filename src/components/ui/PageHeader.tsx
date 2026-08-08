import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backPath?: string;
  backLabel?: string;
  badge?: string;
  action?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  backPath,
  backLabel = 'Quay lại',
  badge,
  action,
}) => {
  return (
    <div className="space-y-2 mb-6">
      {backPath && (
        <NavLink
          to={backPath}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors mb-1"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </NavLink>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <div className="space-y-1">
          {badge && (
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-ori-50 text-ori-600 text-[11px] font-bold uppercase tracking-wider">
              {badge}
            </span>
          )}
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500">{subtitle}</p>}
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
};
