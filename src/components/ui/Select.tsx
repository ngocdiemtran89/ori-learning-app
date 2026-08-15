import React from 'react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  helperText?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, helperText, error, className = '', id, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={selectId} className="type-label block text-slate-700">
            {label}
          </label>
        )}

        <select
          id={selectId}
          ref={ref}
          className={`
            w-full h-10 px-3 text-sm bg-white border rounded-xl text-slate-900 cursor-pointer
            transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ori-500 focus:border-ori-500
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed
            ${error ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300'}
            ${className}
          `.trim()}
          {...props}
        >
          {options.map((opt) => (
            <option key={String(opt.value)} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {(error || helperText) && (
          <p className={`type-helper ${error ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
