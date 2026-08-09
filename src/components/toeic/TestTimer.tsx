import React, { useState, useEffect, useCallback } from 'react';
import { Clock } from 'lucide-react';

interface TestTimerProps {
  startedAt: string;
  durationMinutes: number;
  onTimeExpired: () => void;
}

export const TestTimer: React.FC<TestTimerProps> = ({
  startedAt,
  durationMinutes,
  onTimeExpired,
}) => {
  const calculateRemaining = useCallback(() => {
    const start = new Date(startedAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    const now = Date.now();
    return Math.max(0, Math.floor((end - now) / 1000));
  }, [startedAt, durationMinutes]);

  const [remainingSeconds, setRemainingSeconds] = useState(calculateRemaining);

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onTimeExpired();
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateRemaining, onTimeExpired]);

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  const isLow = remainingSeconds <= 300; // 5 minutes
  const isCritical = remainingSeconds <= 60; // 1 minute

  const formatPad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className={`
      flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition-colors
      ${isCritical
        ? 'bg-red-100 text-red-700 animate-pulse'
        : isLow
          ? 'bg-amber-100 text-amber-700'
          : 'bg-slate-100 text-slate-700'
      }
    `}>
      <Clock className="w-4 h-4" />
      <span className="tabular-nums">
        {hours > 0 && `${formatPad(hours)}:`}{formatPad(minutes)}:{formatPad(seconds)}
      </span>
    </div>
  );
};
