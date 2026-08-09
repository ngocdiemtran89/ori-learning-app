import React, { useState, useMemo } from 'react';
import { ImageIcon, Music, Upload, Trash2, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { ToeicTestGroupInput, ToeicTestQuestionInput } from '../../lib/cms/testBankValidation';
import { getMediaCompleteness, sortGroupsByQuestionRange, getToeicGroupQuestionRange } from '../../lib/toeic/mediaCompleteness';
import { uploadQuestionMedia, removeQuestionMedia, uploadGroupMedia, removeGroupMedia } from '../../lib/supabase/adminTestBank';
import { getToeicMediaSignedUrl } from '../../lib/supabase/storage';

interface MediaManagerTabProps {
  testId: string;
  groups: ToeicTestGroupInput[];
  questions: ToeicTestQuestionInput[];
  onMediaUpdated: () => void;
}

export const MediaManagerTab: React.FC<MediaManagerTabProps> = ({ testId: _testId, groups, questions, onMediaUpdated }) => {
  const metrics = getMediaCompleteness(groups, questions);
  
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const handleUploadQuestionMedia = async (qId: string, file: File, type: 'image' | 'audio') => {
    setLoading(prev => ({ ...prev, [qId]: true }));
    setError(null);
    try {
      const res = await uploadQuestionMedia(qId, file, type);
      if (res.success) {
        onMediaUpdated();
      } else {
        setError(res.error || 'Upload failed');
      }
    } catch (err: any) {
      setError('Unknown error occurred');
    } finally {
      setLoading(prev => ({ ...prev, [qId]: false }));
    }
  };

  const handleRemoveQuestionMedia = async (questionId: string, type: 'image' | 'audio') => {
    if (!window.confirm('Bạn có chắc muốn xóa media này?')) return;
    setLoading(prev => ({ ...prev, [questionId]: true }));
    setError(null);
    try {
      const res = await removeQuestionMedia(questionId, type);
      if (res.success) {
        onMediaUpdated();
      } else {
        setError(res.error || 'Xóa lỗi');
      }
    } catch (err: any) {
      setError('Unknown error occurred');
    } finally {
      setLoading(prev => ({ ...prev, [questionId]: false }));
    }
  };

  const handleUploadGroupMedia = async (gId: string, file: File, type: 'image' | 'audio') => {
    setLoading(prev => ({ ...prev, [gId]: true }));
    setError(null);
    try {
      const res = await uploadGroupMedia(gId, file, type);
      if (res.success) {
        onMediaUpdated();
      } else {
        setError(res.error || 'Upload failed');
      }
    } catch (err: any) {
      setError('Unknown error occurred');
    } finally {
      setLoading(prev => ({ ...prev, [gId]: false }));
    }
  };

  const handleRemoveGroupMedia = async (groupId: string, type: 'image' | 'audio') => {
    if (!window.confirm('Bạn có chắc muốn xóa media nhóm này?')) return;
    setLoading(prev => ({ ...prev, [groupId]: true }));
    setError(null);
    try {
      const res = await removeGroupMedia(groupId, type);
      if (res.success) {
        onMediaUpdated();
      } else {
        setError(res.error || 'Xóa lỗi');
      }
    } catch (err: any) {
      setError('Unknown error occurred');
    } finally {
      setLoading(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const renderMetricCard = (title: string, metric: any, icon: React.ReactNode, isRequired: boolean) => {
    const isComplete = metric.ready === metric.expected && metric.expected > 0;
    const isError = isRequired && metric.missing.length > 0;
    const isWarning = !isRequired && metric.missing.length > 0;

    return (
      <div className={`p-4 rounded-2xl border ${isComplete ? 'bg-emerald-50 border-emerald-200' : isError ? 'bg-red-50 border-red-200' : isWarning ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-extrabold flex items-center gap-1">
            {icon} {title}
          </h4>
          {isComplete && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          {(isError || isWarning) && <AlertTriangle className={`w-4 h-4 ${isError ? 'text-red-500' : 'text-amber-500'}`} />}
        </div>
        <div className="text-sm font-bold">
          {metric.ready} / {metric.expected}
        </div>
        {metric.missing.length > 0 && (
           <div className={`text-[10px] mt-1 ${isError ? 'text-red-600' : 'text-amber-600'}`}>
             Thiếu: {metric.missing.join(', ')}
           </div>
        )}
      </div>
    );
  };

  const MediaPreview = ({ url, type }: { url: string | null | undefined, type: 'image' | 'audio' }) => {
    const [signedUrl, setSignedUrl] = useState<string | null>(null);
    
    React.useEffect(() => {
      if (url) {
        getToeicMediaSignedUrl(url).then(setSignedUrl);
      } else {
        setSignedUrl(null);
      }
    }, [url]);

    if (!url) return <span className="text-slate-400 italic text-[10px]">Chưa có media</span>;
    if (!signedUrl) return <Loader2 className="w-4 h-4 animate-spin text-slate-400" />;

    if (type === 'image') {
      return <img src={signedUrl} alt="Preview" className="h-12 w-auto object-cover rounded-lg border border-slate-200" />;
    } else {
      return <audio src={signedUrl} controls className="h-8 w-40" />;
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {renderMetricCard('Part 1 Ảnh', metrics.part1Images, <ImageIcon className="w-3.5 h-3.5" />, true)}
        {renderMetricCard('Part 1 Audio', metrics.part1Audio, <Music className="w-3.5 h-3.5" />, true)}
        {renderMetricCard('Part 2 Audio', metrics.part2Audio, <Music className="w-3.5 h-3.5" />, true)}
        {renderMetricCard('Part 3 Audio', metrics.part3Audio, <Music className="w-3.5 h-3.5" />, true)}
        {renderMetricCard('Part 4 Audio', metrics.part4Audio, <Music className="w-3.5 h-3.5" />, true)}
      </div>

      {!metrics.publishReady && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 text-red-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm font-bold">
            <p>Đề thi chưa đủ điều kiện xuất bản (thiếu media bắt buộc).</p>
          </div>
        </div>
      )}

      {/* Part 1 */}
      <div className="space-y-3">
        <h4 className="text-sm font-extrabold text-slate-900 border-b pb-2">Part 1 (Questions 1-6)</h4>
        <div className="grid grid-cols-1 gap-2">
          {questions.filter(q => q.part === 'part1' && q.is_active !== false).map(q => (
            <div key={q.id} className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="font-bold text-sm w-16">Câu #{q.question_number}</div>
              
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <div className="w-20"><MediaPreview url={q.image_url} type="image" /></div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1">
                    {loading[q.id!] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Ảnh
                    <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={(e) => { if (e.target.files?.[0]) handleUploadQuestionMedia(q.id!, e.target.files[0], 'image') }} disabled={loading[q.id!]} />
                  </label>
                  {q.image_url && (
                    <button type="button" onClick={() => handleRemoveQuestionMedia(q.id!, 'image')} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <div className="w-40"><MediaPreview url={q.audio_url} type="audio" /></div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1">
                    {loading[q.id!] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Audio
                    <input type="file" className="hidden" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4" onChange={(e) => { if (e.target.files?.[0]) handleUploadQuestionMedia(q.id!, e.target.files[0], 'audio') }} disabled={loading[q.id!]} />
                  </label>
                  {q.audio_url && (
                    <button type="button" onClick={() => handleRemoveQuestionMedia(q.id!, 'audio')} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Part 2 */}
      <div className="space-y-3">
        <h4 className="text-sm font-extrabold text-slate-900 border-b pb-2">Part 2 (Questions 7-31)</h4>
        <div className="grid grid-cols-1 gap-2">
          {questions.filter(q => q.part === 'part2' && q.is_active !== false).map(q => (
            <div key={q.id} className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4">
              <div className="font-bold text-sm w-16">Câu #{q.question_number}</div>
              <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                <div className="w-40"><MediaPreview url={q.audio_url} type="audio" /></div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1">
                    {loading[q.id!] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Audio
                    <input type="file" className="hidden" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4" onChange={(e) => { if (e.target.files?.[0]) handleUploadQuestionMedia(q.id!, e.target.files[0], 'audio') }} disabled={loading[q.id!]} />
                  </label>
                  {q.audio_url && (
                    <button type="button" onClick={() => handleRemoveQuestionMedia(q.id!, 'audio')} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Part 3 & 4 (Groups) */}
      {(['part3', 'part4'] as const).map(part => {
        const partGroups = useMemo(() => 
          sortGroupsByQuestionRange(
            groups.filter(g => g.part === part && g.is_active !== false),
            questions
          ),
          [groups, questions, part]
        );
        return (
        <div key={part} className="space-y-3">
          <h4 className="text-sm font-extrabold text-slate-900 border-b pb-2">{part === 'part3' ? 'Part 3' : 'Part 4'} Groups</h4>
          <div className="grid grid-cols-1 gap-2">
            {partGroups.map(g => {
              const range = getToeicGroupQuestionRange(g.id!, questions);
              return (
              <div key={g.id} className="p-3 bg-white border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-4">
                <div className="font-bold text-sm min-w-[150px]">
                  Questions {range.min === Infinity ? '—' : range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`}
                </div>
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <div className="w-40"><MediaPreview url={g.audio_url} type="audio" /></div>
                  <div className="flex items-center gap-2">
                    <label className="cursor-pointer text-xs font-bold px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1">
                      {loading[g.id!] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Audio Nhóm
                      <input type="file" className="hidden" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4" onChange={(e) => { if (e.target.files?.[0]) handleUploadGroupMedia(g.id!, e.target.files[0], 'audio') }} disabled={loading[g.id!]} />
                    </label>
                    {g.audio_url && (
                      <button type="button" onClick={() => handleRemoveGroupMedia(g.id!, 'audio')} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
        );
      })}
    </div>
  );
};
