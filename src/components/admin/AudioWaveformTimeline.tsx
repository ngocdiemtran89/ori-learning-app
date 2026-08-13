import React, { useRef, useEffect, useState } from 'react';
import { ToeicAudioSegment, formatTimecode } from '../../lib/audioCutter/toeicAudioCutter';

interface AudioWaveformTimelineProps {
  audioBuffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  selectedSegment: ToeicAudioSegment | null;
  segments: ToeicAudioSegment[];
  onSeek: (seconds: number) => void;
  onSelectSegment: (segment: ToeicAudioSegment) => void;
}

export const AudioWaveformTimeline: React.FC<AudioWaveformTimelineProps> = ({
  audioBuffer,
  currentTime,
  duration,
  selectedSegment,
  segments,
  onSeek,
  onSelectSegment,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Draw timeline & waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0f172a');
    bgGradient.addColorStop(1, '#1e293b');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    const safeDuration = duration > 0 ? duration : 100;

    // Draw segment regions
    segments.forEach((seg) => {
      if (seg.startSeconds >= 0 && seg.endSeconds > seg.startSeconds) {
        const xStart = (seg.startSeconds / safeDuration) * width;
        const xEnd = (seg.endSeconds / safeDuration) * width;
        const w = Math.max(xEnd - xStart, 2);

        const isSelected = selectedSegment && selectedSegment.id === seg.id;
        ctx.fillStyle = isSelected
          ? 'rgba(16, 185, 129, 0.35)' // emerald for selected
          : 'rgba(99, 102, 241, 0.15)'; // indigo for others

        ctx.fillRect(xStart, 0, w, height);

        // Border for selected
        if (isSelected) {
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.strokeRect(xStart, 0, w, height);
        }
      }
    });

    // Draw Waveform or Grid
    if (audioBuffer) {
      const channelData = audioBuffer.getChannelData(0);
      const step = Math.ceil(channelData.length / width);
      const amp = height / 2;

      ctx.beginPath();
      ctx.strokeStyle = '#38bdf8'; // Sky blue waveform
      ctx.lineWidth = 1;

      for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
          const datum = channelData[i * step + j];
          if (datum < min) min = datum;
          if (datum > max) max = datum;
        }
        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
      }
      ctx.stroke();
    } else {
      // Draw grid lines
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      const numTicks = 10;
      for (let i = 0; i <= numTicks; i++) {
        const x = (i / numTicks) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Label
        const timeSec = (i / numTicks) * safeDuration;
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px sans-serif';
        ctx.fillText(formatTimecode(timeSec), x + 4, height - 6);
      }
    }

    // Draw Current Playhead
    const playheadX = (currentTime / safeDuration) * width;
    ctx.strokeStyle = '#ef4444'; // Red playhead
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    // Playhead handle on top
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(playheadX, 8, 6, 0, 2 * Math.PI);
    ctx.fill();
  }, [audioBuffer, currentTime, duration, selectedSegment, segments]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = 120;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    updateTimeFromPointer(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      updateTimeFromPointer(e);
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const updateTimeFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const targetSeconds = (x / rect.width) * duration;
    onSeek(targetSeconds);

    // Find if click landed on a segment
    const clickedSeg = segments.find(
      (s) => s.startSeconds >= 0 && s.endSeconds > s.startSeconds && targetSeconds >= s.startSeconds && targetSeconds <= s.endSeconds
    );
    if (clickedSeg) {
      onSelectSegment(clickedSeg);
    }
  };

  return (
    <div ref={containerRef} className="w-full relative select-none">
      <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-1 px-1">
        <span>00:00.000</span>
        <span className="text-emerald-400 font-bold">
          PLAYHEAD: {formatTimecode(currentTime)}
        </span>
        <span>{formatTimecode(duration)}</span>
      </div>

      <div className="relative rounded-xl overflow-hidden border border-slate-700 shadow-inner group">
        <canvas
          ref={canvasRef}
          height={120}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-28 cursor-pointer block"
        />
      </div>

      <div className="mt-1 text-[11px] text-slate-500 text-center flex justify-center gap-4">
        <span>💡 Nhấp hoặc kéo trên sóng âm để dịch chuyển thời gian</span>
        {selectedSegment && (
          <span className="text-emerald-400 font-medium">
            Khung xanh: [{formatTimecode(selectedSegment.startSeconds)} → {formatTimecode(selectedSegment.endSeconds)}]
          </span>
        )}
      </div>
    </div>
  );
};
