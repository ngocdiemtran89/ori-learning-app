import React from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode | React.ComponentType<any> | any;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon = <Inbox className="w-8 h-8 text-slate-400" />,
  action,
  className = '',
}) => {
  const IconComp = typeof icon === 'function' ? (icon as React.ElementType) : null;

  return (
    <div
      className={`p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 flex flex-col items-center justify-center space-y-4 ${className}`.trim()}
    >
      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs">
        {IconComp ? <IconComp className="w-8 h-8 text-slate-400" /> : (icon as React.ReactNode)}
      </div>

      <div className="space-y-1 max-w-sm mx-auto">
        <h3 className="type-component-heading text-slate-800">{title}</h3>
        {description && <p className="type-body text-slate-500">{description}</p>}
      </div>

      {action && <div className="pt-2">{action}</div>}
    </div>
  );
};
