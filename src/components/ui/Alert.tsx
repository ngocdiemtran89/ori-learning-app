import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onDismiss,
  className = '',
}) => {
  const variantStyles = {
    info: 'bg-sky-50/80 border-sky-200 text-sky-900 icon-sky-600',
    success: 'bg-emerald-50/80 border-emerald-200 text-emerald-900 icon-emerald-600',
    warning: 'bg-amber-50/80 border-amber-200 text-amber-950 icon-amber-600',
    danger: 'bg-rose-50/80 border-rose-200 text-rose-900 icon-rose-600',
  };

  const icons = {
    info: <Info className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />,
    danger: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />,
  };

  return (
    <div
      className={`p-4 border rounded-2xl flex items-start gap-3 transition-all ${variantStyles[variant]} ${className}`.trim()}
    >
      {icons[variant]}

      <div className="flex-1 space-y-1">
        {title && <h4 className="type-component-heading text-current">{title}</h4>}
        <div className="type-body text-current opacity-95 leading-relaxed">{children}</div>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-black/5 text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
