import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Timer } from 'lucide-react';

interface TestTimerProps {
  startedAt: string;
  durationMinutes: number | null;
  onTimeExpired: () => void;
  /** If true, show elapsed stopwatch instead of countdown */
  isStopwatch?: boolean;
  /** Initial elapsed seconds stored in DB (for stopwatch mode) */
  initialElapsedSeconds?: number;
  /** Callback fired on each tick in stopwatch mode with current elapsed seconds */
  onElapsedTick?: (elapsedSeconds: number) => void;
}

export const TestTimer: React.FC<TestTimerProps> = ({
  startedAt,
  durationMinutes,
  onTimeExpired,
  isStopwatch = false,
  initialElapsedSeconds = 0,
  onElapsedTick,
}) => {
  const calculateRemaining = useCallback(() => {
    if (durationMinutes == null) return 0;
    const start = new Date(startedAt).getTime();
    const end = start + durationMinutes * 60 * 1000;
    const now = Date.now();
    return Math.max(0, Math.floor((end - now) / 1000));
  }, [startedAt, durationMinutes]);

  const [seconds, setSeconds] = useState(
    isStopwatch ? (initialElapsedSeconds || 0) : calculateRemaining()
  );

  useEffect(() => {
    if (isStopwatch) {
      setSeconds(initialElapsedSeconds || 0);
    } else {
      setSeconds(calculateRemaining());
    }
  }, [initialElapsedSeconds, isStopwatch, calculateRemaining]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (isStopwatch) {
        setSeconds((prev) => {
          const next = prev + 1;
          if (onElapsedTick) onElapsedTick(next);
          return next;
        });
      } else {
        const remaining = calculateRemaining();
        setSeconds(remaining);
        if (remaining <= 0) {
          clearInterval(timer);
          onTimeExpired();
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateRemaining, onTimeExpired, isStopwatch, onElapsedTick]);

  const displaySeconds = seconds;
  const hours = Math.floor(displaySeconds / 3600);
  const minutes = Math.floor((displaySeconds % 3600) / 60);
  const secs = displaySeconds % 60;

  const isLow = !isStopwatch && displaySeconds <= 300;
  const isCritical = !isStopwatch && displaySeconds <= 60;

  const formatPad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className={`
      flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold transition-colors
      ${isCritical
        ? 'bg-red-100 text-red-700 animate-pulse'
        : isLow
          ? 'bg-amber-100 text-amber-700'
          : isStopwatch
            ? 'bg-sky-50 text-sky-700'
            : 'bg-slate-100 text-slate-700'
      }
    `}>
      {isStopwatch ? <Timer className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
      <span className="tabular-nums">
        {hours > 0 && `${formatPad(hours)}:`}{formatPad(minutes)}:{formatPad(secs)}
      </span>
    </div>
  );
};
