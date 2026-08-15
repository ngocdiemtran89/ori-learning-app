import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string | React.ReactNode;
  description?: string | React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode | React.ElementType | any;
  breadcrumbs?: Array<{ label: string; href?: string }>;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  badge,
  actions,
  action,
  breadcrumbs,
}) => {
  const displaySub = subtitle || description;
  const displayActions = actions || action;
  return (
    <div className="pb-6 mb-6 border-b border-slate-200/80 space-y-3">
      {/* Breadcrumbs if present */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-slate-300">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-slate-800 transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-slate-700 font-semibold">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {/* Main Title & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1 max-w-3xl">
          <div className="flex items-center gap-2.5">
            <h1 className="type-page-title">{title}</h1>
            {badge}
          </div>
          {displaySub && (
            <div className="type-body text-slate-600 max-w-2xl">{displaySub}</div>
          )}
        </div>

        {displayActions && (
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-center">
            {displayActions}
          </div>
        )}
      </div>
    </div>
  );
};
