import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Đang tải dữ liệu học tập...',
}) => {
  return (
    <div className="min-h-[200px] flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-slate-200 shadow-sm text-center">
      <Loader2 className="w-8 h-8 text-ori-600 animate-spin mb-3" />
      <p className="text-xs font-semibold text-slate-500">{message}</p>
    </div>
  );
};
