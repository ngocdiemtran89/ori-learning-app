import React from 'react';

export interface SectionHeaderProps {
  title: string;
  subtitle?: string | React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  badge,
  actions,
}) => {
  return (
    <div className="flex items-center justify-between gap-4 pb-3 mb-4 border-b border-slate-100">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <h2 className="type-section-heading">{title}</h2>
          {badge}
        </div>
        {subtitle && <div className="type-helper text-slate-500">{subtitle}</div>}
      </div>

      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
};
