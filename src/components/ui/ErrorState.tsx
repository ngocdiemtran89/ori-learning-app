import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Có lỗi xảy ra',
  message,
  onRetry,
}) => {
  return (
    <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-800">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div>
          <h4 className="font-extrabold text-sm">{title}</h4>
          <p className="text-xs text-rose-700 mt-0.5">{message}</p>
        </div>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Thử lại
        </button>
      )}
    </div>
  );
};
