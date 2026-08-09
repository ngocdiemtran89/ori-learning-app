import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getToeicMediaSignedUrl } from '../../lib/supabase/storage';

interface ListeningMediaProps {
  audioUrl: string | null;
  imageUrl: string | null;
}

export const ListeningMedia: React.FC<ListeningMediaProps> = ({ audioUrl, imageUrl }) => {
  const [signedAudio, setSignedAudio] = useState<string | null>(null);
  const [signedImage, setSignedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const resolve = async () => {
      const [audio, image] = await Promise.all([
        audioUrl ? getToeicMediaSignedUrl(audioUrl) : Promise.resolve(null),
        imageUrl ? getToeicMediaSignedUrl(imageUrl) : Promise.resolve(null),
      ]);
      if (!cancelled) {
        setSignedAudio(audio);
        setSignedImage(image);
        setLoading(false);
      }
    };

    resolve();
    return () => { cancelled = true; };
  }, [audioUrl, imageUrl]);

  if (!audioUrl && !imageUrl) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Đang tải media...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {signedImage && (
        <div className="flex justify-center">
          <img
            src={signedImage}
            alt="Question image"
            className="max-h-64 w-auto object-contain rounded-xl border border-slate-200 shadow-sm"
          />
        </div>
      )}
      {signedAudio && (
        <div className="flex justify-center">
          <audio
            src={signedAudio}
            controls
            className="w-full max-w-md"
          />
        </div>
      )}
    </div>
  );
};
