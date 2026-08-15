import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline' | string;
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode | React.ComponentType<any> | any;
  rightIcon?: React.ReactNode | React.ComponentType<any> | any;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // Base styles: clear typography, baseline alignment, optical gap
    const baseStyle =
      'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none shrink-0';

    const variantStyles = {
      primary:
        'bg-ori-600 hover:bg-ori-700 text-white shadow-xs focus:ring-ori-500 active:scale-[0.99]',
      secondary:
        'bg-slate-900 hover:bg-slate-800 text-white shadow-xs focus:ring-slate-700 active:scale-[0.99]',
      success:
        'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs focus:ring-emerald-500 active:scale-[0.99]',
      danger:
        'bg-rose-600 hover:bg-rose-700 text-white shadow-xs focus:ring-rose-500 active:scale-[0.99]',
      ghost:
        'bg-transparent hover:bg-slate-100 text-slate-700 hover:text-slate-900 focus:ring-slate-400',
      outline:
        'bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 hover:text-slate-900 shadow-2xs focus:ring-slate-400',
    };

    const sizeStyles = {
      sm: 'h-9 px-3 text-xs gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-11 px-5 text-sm gap-2',
    };

    const combinedClassName = `${baseStyle} ${variantStyles[variant as keyof typeof variantStyles] || variantStyles.primary} ${sizeStyles[size]} ${className}`.trim();

    const LeftIconComp = typeof leftIcon === 'function' ? (leftIcon as React.ElementType) : null;
    const RightIconComp = typeof rightIcon === 'function' ? (rightIcon as React.ElementType) : null;

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={combinedClassName}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : LeftIconComp ? (
          <LeftIconComp className="w-4 h-4 shrink-0" />
        ) : (
          (leftIcon as React.ReactNode)
        )}
        {children && <span>{children}</span>}
        {!isLoading && (RightIconComp ? <RightIconComp className="w-4 h-4 shrink-0" /> : (rightIcon as React.ReactNode))}
      </button>
    );
  }
);

Button.displayName = 'Button';
