import React from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, helperText, error, className = '', id, rows = 3, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="space-y-1.5 w-full">
        {label && (
          <label htmlFor={textareaId} className="type-label block text-slate-700">
            {label}
          </label>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          rows={rows}
          className={`
            w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl text-slate-900 placeholder:text-slate-400
            transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ori-500 focus:border-ori-500
            disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed leading-relaxed
            ${error ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-300'}
            ${className}
          `.trim()}
          {...props}
        />

        {(error || helperText) && (
          <p className={`type-helper ${error ? 'text-rose-600 font-medium' : 'text-slate-500'}`}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
