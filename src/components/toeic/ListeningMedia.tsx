import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Volume2, Play, Pause, AlertCircle } from 'lucide-react';
import { getToeicMediaSignedUrl } from '../../lib/supabase/storage';

interface ListeningMediaProps {
  audioUrl: string | null;
  imageUrl: string | null;
  part?: string;
  isAudioRequired?: boolean;
  cueStartMs?: number | null;
  cueEndMs?: number | null;
  showImage?: boolean;
  showAudio?: boolean;
  compactAudio?: boolean;
}

export const ListeningMedia: React.FC<ListeningMediaProps> = ({
  audioUrl,
  imageUrl,
  part,
  isAudioRequired = false,
  cueStartMs,
  cueEndMs,
  showImage = true,
  showAudio = true,
  compactAudio = false,
}) => {
  const [signedAudio, setSignedAudio] = useState<string | null>(null);
  const [signedImage, setSignedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isListeningPart = part ? ['part1', 'part2', 'part3', 'part4'].includes(part) : false;
  const isPart1 = part === 'part1';

  const missingAudio = isListeningPart && isAudioRequired && !audioUrl;
  const missingImage = isPart1 && !imageUrl;

  useEffect(() => {
    let cancelled = false;

    if (audioUrl || imageUrl) {
      setLoading(true);
    } else {
      setSignedAudio(null);
      setSignedImage(null);
      setLoading(false);
      return;
    }

    const resolve = async () => {
      const [audio, image] = await Promise.all([
        audioUrl ? getToeicMediaSignedUrl(audioUrl) : Promise.resolve(null),
        imageUrl ? getToeicMediaSignedUrl(imageUrl) : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setSignedAudio(audio);
        setSignedImage(image);
        setLoading(false);
        setAutoplayBlocked(false);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [audioUrl, imageUrl]);

  // Handle initial seek & autoplay when audio or cue changes
  useEffect(() => {
    if (signedAudio && audioRef.current) {
      if (cueStartMs != null && cueStartMs >= 0) {
        audioRef.current.currentTime = cueStartMs / 1000;
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch((err) => {
        console.log('Autoplay blocked by browser:', err);
        setIsPlaying(false);
        setAutoplayBlocked(true);
      });
    }
  }, [signedAudio, cueStartMs]);

  // Handle cue end boundaries on timeupdate
  const handleTimeUpdate = () => {
    if (!audioRef.current || cueEndMs == null) return;
    const endSec = cueEndMs / 1000;
    if (audioRef.current.currentTime >= endSec) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (cueStartMs != null) {
        audioRef.current.currentTime = cueStartMs / 1000;
      }
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      if (cueEndMs != null && audioRef.current.currentTime >= cueEndMs / 1000) {
        if (cueStartMs != null) audioRef.current.currentTime = cueStartMs / 1000;
      }
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch(() => {
        setAutoplayBlocked(true);
      });
    }
  };

  if (!audioUrl && !imageUrl && !missingAudio && !missingImage) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 text-slate-400 text-xs py-3">
        <Loader2 className="w-4 h-4 animate-spin text-ori-600" />
        Đang tải media...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* IMAGE SECTION */}
      {showImage && (
        signedImage ? (
          <div className="flex justify-center">
            <img
              src={signedImage}
              alt="Photograph"
              className="max-h-[440px] w-auto object-contain rounded-2xl border border-slate-200 shadow-md"
            />
          </div>
        ) : missingImage ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-medium flex items-center justify-center gap-2 max-w-xl mx-auto">
            <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            Chưa có hình ảnh cho câu này.
          </div>
        ) : null
      )}

      {/* AUDIO SECTION */}
      {showAudio && (
        signedAudio ? (
          compactAudio ? (
            <div className="bg-slate-900 text-white rounded-xl p-3 shadow-md flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                <Volume2 className={`w-4 h-4 text-ori-400 shrink-0 ${isPlaying ? 'animate-pulse' : ''}`} />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-200 truncate">Listening Audio</span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {isPlaying ? 'Đang phát...' : 'Phát lại audio'}
                  </span>
                </div>
              </div>

              <audio
                ref={audioRef}
                src={signedAudio}
                onTimeUpdate={handleTimeUpdate}
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                className="hidden"
              />

              <button
                type="button"
                onClick={togglePlay}
                className="px-3.5 py-1.5 bg-ori-600 hover:bg-ori-500 text-white font-extrabold text-xs rounded-lg transition-colors flex items-center gap-1 shrink-0 shadow-xs"
              >
                {isPlaying ? <><Pause className="w-3.5 h-3.5" /> Dừng</> : <><Play className="w-3.5 h-3.5" /> Phát lại audio</>}
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 max-w-xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ori-600/30 flex items-center justify-center text-ori-400">
                  <Volume2 className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-200 flex items-center gap-2">
                    <span>Listening Audio</span>
                    {cueStartMs != null && cueEndMs != null && (
                      <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[10px] font-mono">
                        Cue {(cueStartMs / 1000).toFixed(1)}s - {(cueEndMs / 1000).toFixed(1)}s
                      </span>
                    )}
                    {isPlaying && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold">
                        Đang phát
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {isPlaying ? 'Đang tự động phát âm thanh...' : autoplayBlocked ? 'Trình duyệt đã chặn tự động phát' : 'Nhấn nút để nghe'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <audio
                  ref={audioRef}
                  src={signedAudio}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={() => setIsPlaying(false)}
                  onPause={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={togglePlay}
                  className={`
                    w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-sm
                    ${isPlaying
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                      : autoplayBlocked
                        ? 'bg-ori-600 hover:bg-ori-500 text-white ring-2 ring-ori-400/50'
                        : 'bg-ori-600 hover:bg-ori-500 text-white'
                    }
                  `}
                >
                  {isPlaying ? (
                    <><Pause className="w-4 h-4" /> Tạm dừng</>
                  ) : (
                    <><Play className="w-4 h-4" /> {autoplayBlocked ? '▶ Phát audio' : 'Phát audio'}</>
                  )}
                </button>
              </div>
            </div>
          )
        ) : missingAudio ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2 max-w-xl mx-auto">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Audio của câu này chưa được cấu hình.
          </div>
        ) : null
      )}
    </div>
  );
};
