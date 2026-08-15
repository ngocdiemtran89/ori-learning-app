import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  border = true,
  className = '',
  ...props
}) => {
  const baseStyle = 'bg-white rounded-2xl transition-all';
  const borderStyle = border ? 'border border-slate-200/90 shadow-2xs' : '';

  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const combinedClassName = `${baseStyle} ${borderStyle} ${paddingStyles[padding]} ${className}`.trim();

  return (
    <div className={combinedClassName} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`pb-4 border-b border-slate-100 mb-5 flex items-center justify-between gap-4 ${className}`.trim()} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  children,
  className = '',
  ...props
}) => (
  <div className={`pt-4 border-t border-slate-100 mt-5 flex items-center justify-between gap-4 ${className}`.trim()} {...props}>
    {children}
  </div>
);
