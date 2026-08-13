import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Headphones,
  Upload,
  Play,
  Pause,
  RotateCcw,
  Download,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Sparkles,
  Volume2,
  Zap,
  Eye,
  Sliders,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import {
  ToeicAudioSegment,
  createToeicListeningTemplate,
  validateSegments,
  exportSegments,
  importSegments,
  playSegment,
  formatTimecode,
  getSegmentStatus,
  saveLocalDraft,
  loadLocalDraft,
  clearLocalDraft,
  SegmentValidationStatus,
} from '../lib/audioCutter/toeicAudioCutter';
import { AudioWaveformTimeline } from '../components/admin/AudioWaveformTimeline';

export const AdminToeicAudioCutterPage: React.FC = () => {
  // File & Audio states
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioFileName, setAudioFileName] = useState<string>('toeic_listening.mp3');
  const [duration, setDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  // Segments states
  const [segments, setSegments] = useState<ToeicAudioSegment[]>(() => createToeicListeningTemplate());
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('p1-q1');
  const [partFilter, setPartFilter] = useState<number | 'ALL'>('ALL');
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [draftMessage, setDraftMessage] = useState<string | null>(null);

  // Import / Export Feedback
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const jsonImportRef = useRef<HTMLInputElement | null>(null);
  const stopSegmentPlaybackRef = useRef<(() => void) | null>(null);

  // Selected Segment object
  const selectedSegment = useMemo(() => {
    return segments.find((s) => s.id === selectedSegmentId) || segments[0] || null;
  }, [segments, selectedSegmentId]);

  // Validation
  const validation: SegmentValidationStatus = useMemo(() => {
    return validateSegments(segments, duration);
  }, [segments, duration]);

  // Filtered Segments list
  const filteredSegments = useMemo(() => {
    if (partFilter === 'ALL') return segments;
    return segments.filter((s) => s.part === partFilter);
  }, [segments, partFilter]);

  // Auto-load local draft on file load or initial mount
  useEffect(() => {
    if (audioFileName) {
      const draft = loadLocalDraft(audioFileName);
      if (draft && Array.isArray(draft) && draft.length > 0) {
        setDraftMessage('Phát hiện bản nháp đã lưu trên trình duyệt.');
      } else {
        setDraftMessage(null);
      }
    }
  }, [audioFileName]);

  // Autosave to localStorage on segment changes
  useEffect(() => {
    if (audioFileName && segments.length > 0) {
      saveLocalDraft(audioFileName, segments);
    }
  }, [segments, audioFileName]);

  // Handle Audio File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setAudioFileName(file.name);
    setImportErrors([]);
    setImportSuccess(null);

    // Decode Audio Buffer for Waveform
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      if (arrayBuffer) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const decoded = await audioCtx.decodeAudioData(arrayBuffer);
          setAudioBuffer(decoded);
          setDuration(decoded.duration);
        } catch (err) {
          console.warn('Could not decode audio data for waveform:', err);
          setAudioBuffer(null);
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do NOT trigger shortcuts when typing in inputs/textareas
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT' ||
          activeEl.isContentEditable)
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Space = Play/Pause
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      }
      // S = Set START = current
      else if (key === 's') {
        e.preventDefault();
        setSegmentStartToCurrent();
      }
      // E = Set END = current
      else if (key === 'e') {
        e.preventDefault();
        setSegmentEndToCurrent();
      }
      // ArrowLeft = Seek -1s (Shift: -5s)
      else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        seekRelative(-step);
      }
      // ArrowRight = Seek +1s (Shift: +5s)
      else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 1;
        seekRelative(step);
      }
      // N = Next Segment
      else if (key === 'n') {
        e.preventDefault();
        navigateSegment(1);
      }
      // P = Previous Segment
      else if (key === 'p') {
        e.preventDefault();
        navigateSegment(-1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, selectedSegmentId, segments, isPlaying]);

  // Audio Playback Controls
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const seekTo = (seconds: number) => {
    const audio = audioRef.current;
    const bounded = Math.max(0, Math.min(seconds, duration || 9999));
    setCurrentTime(bounded);
    if (audio) {
      audio.currentTime = bounded;
    }
  };

  const seekRelative = (deltaSeconds: number) => {
    seekTo(currentTime + deltaSeconds);
  };

  const changePlaybackRate = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // Segment Navigation (Next/Prev)
  const navigateSegment = (direction: 1 | -1) => {
    const currentIndex = filteredSegments.findIndex((s) => s.id === selectedSegmentId);
    if (currentIndex === -1) return;
    const newIndex = currentIndex + direction;
    if (newIndex >= 0 && newIndex < filteredSegments.length) {
      setSelectedSegmentId(filteredSegments[newIndex].id);
    }
  };

  // Set Start/End to Current Time
  const setSegmentStartToCurrent = () => {
    if (!selectedSegment) return;
    updateSegmentTime(selectedSegment.id, currentTime, selectedSegment.endSeconds);
  };

  const setSegmentEndToCurrent = () => {
    if (!selectedSegment) return;
    updateSegmentTime(selectedSegment.id, selectedSegment.startSeconds, currentTime);
  };

  // Adjust Start / End by delta
  const adjustSegmentStart = (delta: number) => {
    if (!selectedSegment) return;
    const newStart = Math.max(0, selectedSegment.startSeconds + delta);
    updateSegmentTime(selectedSegment.id, newStart, selectedSegment.endSeconds);
  };

  const adjustSegmentEnd = (delta: number) => {
    if (!selectedSegment) return;
    const newEnd = Math.max(0, selectedSegment.endSeconds + delta);
    updateSegmentTime(selectedSegment.id, selectedSegment.startSeconds, newEnd);
  };

  const updateSegmentTime = (segmentId: string, start: number, end: number) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id === segmentId) {
          return {
            ...s,
            startSeconds: Math.round(start * 1000) / 1000,
            endSeconds: Math.round(end * 1000) / 1000,
          };
        }
        return s;
      })
    );
  };

  // Play Segment Action
  const handlePlaySelectedSegment = () => {
    const audio = audioRef.current;
    if (!audio || !selectedSegment) return;

    if (stopSegmentPlaybackRef.current) {
      stopSegmentPlaybackRef.current();
    }

    setIsPlaying(true);
    stopSegmentPlaybackRef.current = playSegment(audio, selectedSegment, () => {
      setIsPlaying(false);
    });
  };

  // Template Generation
  const handleCreateTemplate = () => {
    if (
      segments.some((s) => s.startSeconds > 0 || s.endSeconds > 0) &&
      !window.confirm('Tạo lại khung TOEIC 100 câu sẽ ghi đè danh sách hiện tại. Bạn có chắc chắn?')
    ) {
      return;
    }
    const template = createToeicListeningTemplate();
    setSegments(template);
    setSelectedSegmentId(template[0].id);
    setImportSuccess('Đã tạo khung TOEIC 100 câu chuẩn (54 phân đoạn).');
  };

  // Import JSON
  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const jsonStr = evt.target?.result as string;
      const res = importSegments(jsonStr, duration);

      if (res.success && res.data) {
        setSegments(res.data.segments);
        setSelectedSegmentId(res.data.segments[0]?.id || 'p1-q1');
        setImportErrors([]);
        setImportSuccess(`Đã import thành công ${res.data.segments.length} phân đoạn từ ${res.data.audioFileName}.`);
      } else {
        setImportErrors(res.errors);
        setImportSuccess(null);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export JSON
  const handleExportJson = () => {
    const jsonStr = exportSegments(audioFileName, duration, segments);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const cleanBaseName = audioFileName.replace(/\.[^/.]+$/, '');
    link.href = url;
    link.download = `${cleanBaseName}-segments.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Local Draft Restore / Clear
  const handleRestoreDraft = () => {
    const draft = loadLocalDraft(audioFileName);
    if (draft && Array.isArray(draft)) {
      setSegments(draft);
      if (draft[0]) setSelectedSegmentId(draft[0].id);
      setDraftMessage(null);
      setImportSuccess('Đã khôi phục bản nháp từ bộ nhớ trình duyệt!');
    }
  };

  const handleClearDraft = () => {
    clearLocalDraft(audioFileName);
    setDraftMessage(null);
    setImportSuccess('Đã xóa bản nháp khỏi trình duyệt.');
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Hidden Audio Element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Hidden File Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="audio/*"
        className="hidden"
      />
      <input
        type="file"
        ref={jsonImportRef}
        onChange={handleImportJsonFile}
        accept=".json"
        className="hidden"
      />

      {/* Top Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center text-2xl shadow-inner">
              <Headphones className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                <span>🎧 TOEIC AUDIO CUTTER</span>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  v1 Frontend
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Cắt và tạo khung mốc thời gian TOEIC 100 câu nghe — Một audio duy nhất, chính xác đến miligiây.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons Header */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-sm inline-flex items-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Tải File MP3</span>
          </button>

          <button
            type="button"
            onClick={handleCreateTemplate}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs rounded-xl shadow-sm inline-flex items-center gap-2 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>TẠO KHUNG TOEIC 100 CÂU</span>
          </button>

          <button
            type="button"
            onClick={() => jsonImportRef.current?.click()}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-extrabold text-xs rounded-xl shadow-sm inline-flex items-center gap-2 transition-colors"
          >
            <FileJson className="w-4 h-4 text-sky-400" />
            <span>📥 IMPORT JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-sm inline-flex items-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>📤 EXPORT JSON</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`px-3.5 py-2.5 font-extrabold text-xs rounded-xl shadow-sm inline-flex items-center gap-2 transition-colors ${
              isPreviewMode
                ? 'bg-amber-500 text-slate-950 font-black'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>{isPreviewMode ? 'VỀ CHẾ ĐỘ SỬA' : 'XEM NHƯ HỌC VIÊN'}</span>
          </button>
        </div>
      </div>

      {/* Notifications / Banners */}
      {draftMessage && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>{draftMessage}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRestoreDraft}
              className="px-3 py-1 bg-amber-500 text-slate-950 font-extrabold rounded-lg hover:bg-amber-400 transition-colors"
            >
              KHÔI PHỤC BẢN NHÁP
            </button>
            <button
              onClick={handleClearDraft}
              className="px-3 py-1 bg-slate-800 text-slate-300 font-bold rounded-lg hover:bg-slate-700 transition-colors"
            >
              XÓA BẢN NHÁP
            </button>
          </div>
        </div>
      )}

      {importSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{importSuccess}</span>
        </div>
      )}

      {importErrors.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-xs text-rose-300 space-y-1">
          <div className="font-extrabold flex items-center gap-2 text-rose-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Phát hiện lỗi dữ liệu import / phân đoạn:</span>
          </div>
          <ul className="list-disc pl-6 space-y-0.5">
            {importErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-300 space-y-1">
          <div className="font-extrabold flex items-center gap-2 text-amber-400">
            <Clock className="w-4 h-4 shrink-0" />
            <span>Thông báo phạm vi phân đoạn:</span>
          </div>
          <ul className="list-disc pl-6 space-y-0.5">
            {validation.warnings.map((warn, i) => (
              <li key={i}>{warn}</li>
            ))}
          </ul>
        </div>
      )}

      {/* PREVIEW MODE (STUDENT VIEW) */}
      {isPreviewMode ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl space-y-6 max-w-2xl mx-auto">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                Học viên trải nghiệm nghe
              </span>
              <h2 className="text-xl font-extrabold text-slate-900">
                {selectedSegment?.label || 'Chưa chọn phân đoạn'}
              </h2>
            </div>
            <span className="text-xs font-mono font-bold text-slate-500">
              Part {selectedSegment?.part}
            </span>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 text-white text-center space-y-4">
            <div className="text-3xl font-mono font-black text-emerald-400">
              {formatTimecode(currentTime)}
            </div>
            <div className="text-xs text-slate-400">
              Phạm vi: {formatTimecode(selectedSegment?.startSeconds || 0)} →{' '}
              {formatTimecode(selectedSegment?.endSeconds || 0)}
            </div>

            <div className="flex justify-center items-center gap-4 pt-2">
              <button
                type="button"
                onClick={handlePlaySelectedSegment}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm rounded-xl shadow-md inline-flex items-center gap-2 transition-transform active:scale-95"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>▶ NGHE</span>
              </button>
              <button
                type="button"
                onClick={handlePlaySelectedSegment}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-sm rounded-xl border border-slate-700 inline-flex items-center gap-2 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>↻ NGHE LẠI</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* MAIN EDITING WORKSPACE (3-COLUMN LAYOUT) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: SEGMENT NAVIGATOR (3 COL) */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-4 flex flex-col max-h-[780px]">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>DANH SÁCH BÀI NGHE</span>
                  <span className="text-xs font-semibold text-slate-400">
                    ({segments.length})
                  </span>
                </h3>
              </div>

              {/* Part Filter Tabs */}
              <div className="grid grid-cols-5 gap-1 bg-slate-100 p-1 rounded-xl text-center text-xs font-bold">
                <button
                  onClick={() => setPartFilter('ALL')}
                  className={`py-1 rounded-lg transition-colors ${
                    partFilter === 'ALL'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Tất cả
                </button>
                {[1, 2, 3, 4].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPartFilter(p)}
                    className={`py-1 rounded-lg transition-colors ${
                      partFilter === p
                        ? 'bg-white text-indigo-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>

            {/* Segment List Scroll Area */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {filteredSegments.map((seg) => {
                const status = getSegmentStatus(seg, duration);
                const isSelected = seg.id === selectedSegmentId;

                return (
                  <button
                    key={seg.id}
                    onClick={() => setSelectedSegmentId(seg.id)}
                    className={`w-full text-left p-3 rounded-2xl border text-xs font-medium transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 text-indigo-950 font-extrabold shadow-xs'
                        : 'bg-white border-slate-100 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold">{seg.label}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {status === 'UNSET' ? (
                          'Chưa đặt mốc'
                        ) : (
                          <>
                            {formatTimecode(seg.startSeconds)} → {formatTimecode(seg.endSeconds)}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {status === 'UNSET' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" title="Chưa cắt" />
                      )}
                      {status === 'SET' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" title="Đã có start/end" />
                      )}
                      {status === 'ERROR' && (
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" title="Lỗi timestamp" />
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER COLUMN: MAIN WORKSPACE & WAVEFORM (6 COL) */}
          <div className="lg:col-span-6 space-y-5">
            {/* Main Audio Player Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-indigo-400" />
                  <span className="font-mono text-xs text-slate-300 truncate max-w-[280px]">
                    {audioFileName}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">
                  Tổng dài: <span className="text-white font-bold">{formatTimecode(duration)}</span>
                </div>
              </div>

              {/* Large Timecode Centerpiece */}
              <div className="text-center py-2 space-y-1">
                <div className="text-4xl lg:text-5xl font-mono font-black tracking-tight text-white drop-shadow-sm">
                  {formatTimecode(currentTime)}
                </div>
                <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  CURRENT PLAYHEAD TIMECODE
                </div>
              </div>

              {/* Waveform / Canvas Timeline */}
              <AudioWaveformTimeline
                audioBuffer={audioBuffer}
                currentTime={currentTime}
                duration={duration}
                selectedSegment={selectedSegment}
                segments={segments}
                onSeek={seekTo}
                onSelectSegment={(seg) => setSelectedSegmentId(seg.id)}
              />

              {/* Playback Controls & Speed */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => seekRelative(-5)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                  >
                    -5s
                  </button>
                  <button
                    onClick={() => seekRelative(-1)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                  >
                    -1s
                  </button>
                  <button
                    onClick={togglePlayPause}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-md inline-flex items-center gap-2 transition-transform active:scale-95"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
                    <span>{isPlaying ? 'Tạm dừng (Space)' : 'Phát (Space)'}</span>
                  </button>
                  <button
                    onClick={() => seekRelative(1)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                  >
                    +1s
                  </button>
                  <button
                    onClick={() => seekRelative(5)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
                  >
                    +5s
                  </button>
                </div>

                {/* Speed Controls */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
                  {[0.8, 1.0, 1.2, 1.5].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => changePlaybackRate(rate)}
                      className={`px-2.5 py-1 rounded-lg font-extrabold transition-colors ${
                        playbackRate === rate
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Current Segment Card */}
            {selectedSegment && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                      CÂU ĐANG CHỈNH
                    </span>
                    <h3 className="text-lg font-extrabold text-slate-900">
                      {selectedSegment.label}
                    </h3>
                  </div>
                  <button
                    onClick={handlePlaySelectedSegment}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-sm inline-flex items-center gap-1.5 transition-transform active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>▶ NGHE THỬ PHÂN ĐOẠN</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center font-mono">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">START TIME</div>
                    <div className="text-base font-extrabold text-slate-900">
                      {formatTimecode(selectedSegment.startSeconds)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">END TIME</div>
                    <div className="text-base font-extrabold text-slate-900">
                      {formatTimecode(selectedSegment.endSeconds)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">DURATION</div>
                    <div className="text-base font-extrabold text-indigo-600">
                      {formatTimecode(
                        Math.max(0, selectedSegment.endSeconds - selectedSegment.startSeconds)
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: FINE-TUNING CONTROLS & SHORTCUTS (3 COL) */}
          <div className="lg:col-span-3 space-y-5">
            {/* Quick Set & Fine-Tuning Panel */}
            {selectedSegment && (
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    <span>CÀI ĐẶT MỐC CHÍNH XÁC</span>
                  </h3>
                </div>

                {/* Set Start / End to Current Buttons */}
                <div className="space-y-2">
                  <button
                    onClick={setSegmentStartToCurrent}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-between px-4 transition-transform active:scale-98"
                  >
                    <span>LẤY MỐC BẮT ĐẦU = TẠI ĐÂY</span>
                    <span className="px-1.5 py-0.5 bg-emerald-700 rounded text-[10px] font-mono">S</span>
                  </button>

                  <button
                    onClick={setSegmentEndToCurrent}
                    className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-between px-4 transition-transform active:scale-98"
                  >
                    <span>LẤY MỐC KẾT THÚC = TẠI ĐÂY</span>
                    <span className="px-1.5 py-0.5 bg-rose-700 rounded text-[10px] font-mono">E</span>
                  </button>
                </div>

                {/* Fine Tune Start */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 flex justify-between">
                    <span>TINH CHỈNH START:</span>
                    <span className="font-mono text-slate-900">
                      {formatTimecode(selectedSegment.startSeconds)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      onClick={() => adjustSegmentStart(-0.5)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200"
                    >
                      -0.5s
                    </button>
                    <button
                      onClick={() => adjustSegmentStart(-0.1)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200"
                    >
                      -0.1s
                    </button>
                    <button
                      onClick={() => adjustSegmentStart(0.1)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200"
                    >
                      +0.1s
                    </button>
                    <button
                      onClick={() => adjustSegmentStart(0.5)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200"
                    >
                      +0.5s
                    </button>
                  </div>
                </div>

                {/* Fine Tune End */}
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 flex justify-between">
                    <span>TINH CHỈNH END:</span>
                    <span className="font-mono text-slate-900">
                      {formatTimecode(selectedSegment.endSeconds)}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      onClick={() => adjustSegmentEnd(-0.5)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200"
                    >
                      -0.5s
                    </button>
                    <button
                      onClick={() => adjustSegmentEnd(-0.1)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200"
                    >
                      -0.1s
                    </button>
                    <button
                      onClick={() => adjustSegmentEnd(0.1)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200"
                    >
                      +0.1s
                    </button>
                    <button
                      onClick={() => adjustSegmentEnd(0.5)}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[11px] rounded-lg border border-slate-200"
                    >
                      +0.5s
                    </button>
                  </div>
                </div>

                {/* Segment Stepper Navigation */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    onClick={() => navigateSegment(-1)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Bài trước (P)</span>
                  </button>
                  <button
                    onClick={() => navigateSegment(1)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs rounded-xl flex items-center gap-1"
                  >
                    <span>Bài sau (N)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Shortcuts Cheat Sheet */}
            <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-sm space-y-3">
              <h4 className="font-extrabold text-xs text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-400" />
                <span>PHÍM TẮT NHANH</span>
              </h4>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800">
                  <span>Bật / Tắt Audio</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">Space</kbd>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800">
                  <span>Đặt mốc START</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">S</kbd>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800">
                  <span>Đặt mốc END</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">E</kbd>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800">
                  <span>Tua ±1s</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">← / →</kbd>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-slate-800">
                  <span>Tua ±5s</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">Shift + ← / →</kbd>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span>Chuyển bài trước / sau</span>
                  <kbd className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono border border-slate-700">P / N</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
