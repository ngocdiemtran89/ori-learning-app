import React, { useState, useEffect, useRef } from 'react';
import { Headphones, Play, Download, Upload } from 'lucide-react';
import { AudioSegment } from '../types';
import {
  createToeicListeningTemplate,
  formatTimecode,
  playSegment,
  exportSegments,
  importSegments,
} from '../../../lib/audioCutter/toeicAudioCutter';
import { downloadTextFile } from '../utils/downloadHelper';

interface AudioTabProps {
  audioFile: File | null;
  audioDuration: number;
  audioSegments: AudioSegment[];
  onUpdateSegments: (segments: AudioSegment[]) => void;
}

export const AudioTab: React.FC<AudioTabProps> = ({
  audioFile,
  audioDuration,
  audioSegments,
  onUpdateSegments,
}) => {
  const [segments, setSegments] = useState<AudioSegment[]>(() =>
    audioSegments.length > 0 ? audioSegments : createToeicListeningTemplate()
  );
  const [selectedSegId, setSelectedSegId] = useState<string>('p1-q1');
  const [currentTime, setCurrentTime] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrl = useRef<string | null>(null);

  useEffect(() => {
    if (audioFile) {
      audioUrl.current = URL.createObjectURL(audioFile);
    }
  }, [audioFile]);

  const selectedSeg = segments.find((s) => s.id === selectedSegId) || segments[0];

  const updateSegTime = (segId: string, start: number, end: number) => {
    const updated = segments.map((s) => {
      if (s.id === segId) {
        return {
          ...s,
          startSeconds: Math.round(Math.max(0, start) * 1000) / 1000,
          endSeconds: Math.round(Math.max(0, end) * 1000) / 1000,
        };
      }
      return s;
    });
    setSegments(updated);
    onUpdateSegments(updated);
  };

  const handlePlaySelectedSegment = () => {
    const audio = audioRef.current;
    if (!audio || !selectedSeg) return;
    playSegment(audio, selectedSeg);
  };

  // Keyboard shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const audio = audioRef.current;
      if (!selectedSeg) return;

      const idx = segments.findIndex((s) => s.id === selectedSeg.id);

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (audio) {
            if (audio.paused) {
              audio.play();
            } else {
              audio.pause();
            }
          }
          break;
        case 'KeyS':
          e.preventDefault();
          updateSegTime(selectedSeg.id, currentTime, selectedSeg.endSeconds);
          break;
        case 'KeyE':
          e.preventDefault();
          updateSegTime(selectedSeg.id, selectedSeg.startSeconds, currentTime);
          break;
        case 'KeyN':
          e.preventDefault();
          if (idx < segments.length - 1) setSelectedSegId(segments[idx + 1].id);
          break;
        case 'KeyP':
          e.preventDefault();
          if (idx > 0) setSelectedSegId(segments[idx - 1].id);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (audio) {
            audio.currentTime = Math.max(0, audio.currentTime - (e.shiftKey ? 5 : 1));
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (audio) {
            audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + (e.shiftKey ? 5 : 1));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSeg, segments, currentTime]);

  const handleExportAudioJson = () => {
    const jsonStr = exportSegments(audioFile?.name || 'listening.mp3', audioDuration, segments);
    downloadTextFile(jsonStr, 'toeic-listening-audio-timestamps.json', 'application/json;charset=utf-8');
  };

  const handleImportAudioJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        const res = importSegments(text);
        if (res.success && res.data?.segments) {
          setSegments(res.data.segments);
          onUpdateSegments(res.data.segments);
        } else {
          alert(`Mã Audio Timestamp JSON không hợp lệ: ${res.errors.join(', ')}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6">
      {audioUrl.current && (
        <audio
          ref={audioRef}
          src={audioUrl.current}
          onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
        />
      )}

      {/* Top Header Card */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <Headphones className="w-6 h-6 text-indigo-400" />
              <span>5. CẮT MỐC AUDIO LISTENING Q1–100 (AUDIO TIMESTAMPS)</span>
            </h2>
            <p className="text-xs text-slate-400">
              Phím tắt: SPACE (Play/Pause) • S (Lấy mốc Start) • E (Lấy mốc End) • N (Tiếp) • P (Lùi) • ←/→ (±1s) • Shift+←/→ (±5s)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs rounded-xl cursor-pointer border border-slate-700 transition-colors inline-flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>Import Audio JSON</span>
              <input type="file" accept=".json" onChange={handleImportAudioJson} className="hidden" />
            </label>
            <button
              onClick={handleExportAudioJson}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audio JSON</span>
            </button>
          </div>
        </div>
      </div>

      {/* Workspace: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Segment List (4 col) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-4 shadow-xs space-y-3 max-h-[600px] flex flex-col">
          <h3 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider px-1">
            PHÂN ĐOẠN 54 BÀI NGHE
          </h3>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {segments.map((seg) => {
              const isSelected = seg.id === selectedSegId;
              return (
                <button
                  key={seg.id}
                  onClick={() => setSelectedSegId(seg.id)}
                  className={`w-full text-left p-3 rounded-2xl border text-xs transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 font-extrabold text-indigo-950'
                      : 'bg-slate-50 border-slate-100 hover:border-slate-300 text-slate-700'
                  }`}
                >
                  <div>
                    <div className="font-bold">{seg.label}</div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {formatTimecode(seg.startSeconds)} → {formatTimecode(seg.endSeconds)}
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-600">P{seg.part}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Fine-Tuning & Controls (8 col) */}
        {selectedSeg && (
          <div className="lg:col-span-8 space-y-5">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    CÂU ĐANG CHỈNH AUDIO
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900">{selectedSeg.label}</h3>
                </div>

                <button
                  onClick={handlePlaySelectedSegment}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-md inline-flex items-center gap-2 transition-transform active:scale-95"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>▶ NGHE THỬ PHÂN ĐOẠN</span>
                </button>
              </div>

              {/* Display Big Timecode */}
              <div className="grid grid-cols-3 gap-4 bg-slate-900 text-white p-5 rounded-2xl text-center font-mono">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">START TIME</div>
                  <div className="text-xl font-bold text-emerald-400">{formatTimecode(selectedSeg.startSeconds)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">END TIME</div>
                  <div className="text-xl font-bold text-rose-400">{formatTimecode(selectedSeg.endSeconds)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">DURATION</div>
                  <div className="text-xl font-bold text-indigo-300">
                    {formatTimecode(Math.max(0, selectedSeg.endSeconds - selectedSeg.startSeconds))}
                  </div>
                </div>
              </div>

              {/* Quick Set & Fine-Tune Buttons */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => updateSegTime(selectedSeg.id, currentTime, selectedSeg.endSeconds)}
                    className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    LẤY MỐC START = CURRENT ({formatTimecode(currentTime)}) [S]
                  </button>
                  <button
                    onClick={() => updateSegTime(selectedSeg.id, selectedSeg.startSeconds, currentTime)}
                    className="py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors"
                  >
                    LẤY MỐC END = CURRENT ({formatTimecode(currentTime)}) [E]
                  </button>
                </div>

                {/* Fine-Tuning +/-0.1s and +/-0.5s */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="font-bold text-slate-700 block text-[11px]">TINH CHỈNH START TIME</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateSegTime(selectedSeg.id, selectedSeg.startSeconds - 0.5, selectedSeg.endSeconds)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold"
                      >
                        -0.5s
                      </button>
                      <button
                        onClick={() => updateSegTime(selectedSeg.id, selectedSeg.startSeconds - 0.1, selectedSeg.endSeconds)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold"
                      >
                        -0.1s
                      </button>
                      <button
                        onClick={() => updateSegTime(selectedSeg.id, selectedSeg.startSeconds + 0.1, selectedSeg.endSeconds)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold"
                      >
                        +0.1s
                      </button>
                      <button
                        onClick={() => updateSegTime(selectedSeg.id, selectedSeg.startSeconds + 0.5, selectedSeg.endSeconds)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold"
                      >
                        +0.5s
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <span className="font-bold text-slate-700 block text-[11px]">TINH CHỈNH END TIME</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateSegTime(selectedSeg.id, selectedSeg.startSeconds, selectedSeg.endSeconds - 0.5)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold"
                      >
                        -0.5s
                      </button>
                      <button
                        onClick={() => updateSegTime(selectedSeg.id, selectedSeg.startSeconds, selectedSeg.endSeconds - 0.1)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold"
                      >
                        -0.1s
                      </button>
                      <button
                        onClick={() => updateSegTime(selectedSeg.id, selectedSeg.startSeconds, selectedSeg.endSeconds + 0.1)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold"
                      >
                        +0.1s
                      </button>
                      <button
                        onClick={() => updateSegTime(selectedSeg.id, selectedSeg.startSeconds, selectedSeg.endSeconds + 0.5)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg font-mono font-bold"
                      >
                        +0.5s
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
