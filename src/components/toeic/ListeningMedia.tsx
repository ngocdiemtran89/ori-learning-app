import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Volume2, Play, Pause, AlertCircle } from 'lucide-react';
import { getToeicMediaSignedUrl } from '../../lib/supabase/storage';

interface ListeningMediaProps {
  audioUrl: string | null;
  imageUrl: string | null;
  part?: string;
  isAudioRequired?: boolean;
}

export const ListeningMedia: React.FC<ListeningMediaProps> = ({
  audioUrl,
  imageUrl,
  part,
  isAudioRequired = false,
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

    // Only set loading if there is actually a URL to sign
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

  useEffect(() => {
    if (signedAudio && audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch((err) => {
        console.log('Autoplay blocked by browser:', err);
        setIsPlaying(false);
        setAutoplayBlocked(true);
      });
    }
  }, [signedAudio]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch(() => {
        setAutoplayBlocked(true);
      });
    }
  };

  // Only return null if there are no media URLs AND no media errors to display
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
    <div className="space-y-4">
      {/* IMAGE SECTION */}
      {signedImage ? (
        <div className="flex justify-center">
          <img
            src={signedImage}
            alt="Photograph"
            className="max-h-72 w-auto object-contain rounded-2xl border border-slate-200 shadow-md"
          />
        </div>
      ) : missingImage ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2 max-w-xl mx-auto">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Hình ảnh của câu này chưa được cấu hình.
        </div>
      ) : null}

      {/* AUDIO SECTION */}
      {signedAudio ? (
        <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 max-w-xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-ori-600/30 flex items-center justify-center text-ori-400">
              <Volume2 className={`w-5 h-5 ${isPlaying ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="text-xs font-extrabold text-slate-200 flex items-center gap-2">
                <span>Listening Audio</span>
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
      ) : missingAudio ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold flex items-center gap-2 max-w-xl mx-auto">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Audio của câu này chưa được cấu hình.
        </div>
      ) : null}
    </div>
  );
};
