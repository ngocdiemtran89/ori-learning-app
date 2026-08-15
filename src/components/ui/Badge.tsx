import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | string;
  size?: 'sm' | 'md';
  icon?: React.ReactNode | React.ComponentType<any> | any;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  className = '',
  ...props
}) => {
  const baseStyle =
    'inline-flex items-center font-semibold rounded-md border shrink-0 transition-colors tabular-nums';

  const variantStyles = {
    neutral: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    danger: 'bg-rose-50 text-rose-800 border-rose-200',
    info: 'bg-sky-50 text-sky-800 border-sky-200',
    purple: 'bg-purple-50 text-purple-800 border-purple-200',
  };

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-[11px] leading-none gap-1',
    md: 'px-2 py-0.5 text-xs leading-4 gap-1.5',
  };

  const combinedClassName = `${baseStyle} ${variantStyles[variant as keyof typeof variantStyles] || variantStyles.neutral} ${sizeStyles[size]} ${className}`.trim();
  const IconComp = typeof icon === 'function' ? (icon as React.ElementType) : null;

  return (
    <span className={combinedClassName} {...props}>
      {IconComp ? <IconComp className="w-3.5 h-3.5 shrink-0" /> : (icon as React.ReactNode)}
      {children && <span>{children}</span>}
    </span>
  );
};
