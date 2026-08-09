import React, { useState, useMemo, useEffect } from 'react';
import { ImageIcon, Music, Upload, Trash2, CheckCircle2, AlertTriangle, Loader2, FileCode, Layers, Zap } from 'lucide-react';
import JSZip from 'jszip';
import { ToeicTestGroupInput, ToeicTestQuestionInput, ToeicTestInput } from '../../lib/cms/testBankValidation';
import { getMediaCompleteness, sortGroupsByQuestionRange, getToeicGroupQuestionRange } from '../../lib/toeic/mediaCompleteness';
import {
  uploadQuestionMedia,
  removeQuestionMedia,
  uploadGroupMedia,
  removeGroupMedia,
  updateTestListeningAudioMode,
  uploadToeicListeningTrack,
  upsertListeningCues,
  getListeningCues,
  importBilingualContent
} from '../../lib/supabase/adminTestBank';
import { getToeicMediaSignedUrl } from '../../lib/supabase/storage';
import type { ToeicListeningCue } from '../../lib/supabase/types';

import {
  SequentialMediaType,
  mapSequentialMediaFiles,
  detectSequentialMediaSuggestion,
  isMacNoiseFile,
  SequentialMappingResult
} from '../../lib/cms/sequentialMediaParser';

interface MediaManagerTabProps {
  testId: string;
  test?: ToeicTestInput;
  groups: ToeicTestGroupInput[];
  questions: ToeicTestQuestionInput[];
  onMediaUpdated: () => void;
}

export const MediaManagerTab: React.FC<MediaManagerTabProps> = ({
  testId,
  test,
  groups,
  questions,
  onMediaUpdated
}) => {
  const [cues, setCues] = useState<ToeicListeningCue[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Bulk Media Modal & State
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [rawFiles, setRawFiles] = useState<Array<{ name: string; file: File }>>([]);
  const [bulkMatchMode, setBulkMatchMode] = useState<'ori' | 'sequential'>('ori');
  const [sequentialMediaType, setSequentialMediaType] = useState<SequentialMediaType>('p1_image');
  const [suggestion, setSuggestion] = useState<{ mediaType: SequentialMediaType | null; message: string | null }>({ mediaType: null, message: null });
  const [sequentialResult, setSequentialResult] = useState<SequentialMappingResult | null>(null);
  const [bulkFiles, setBulkFiles] = useState<Array<{ name: string; file: File; sequence?: number | null; type: 'image' | 'audio'; targetType: 'question' | 'group' | 'none'; targetId?: string; targetLabel: string; currentExists: boolean; action: 'upload' | 'skip' | 'invalid' | 'conflict'; status: 'pending' | 'ready' | 'skip' | 'invalid' | 'conflict' | 'uploading' | 'success' | 'failed'; error?: string }>>([]);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Cue Map Modal & State
  const [showCueModal, setShowCueModal] = useState(false);
  const [cueCsvText] = useState('');
  const [parsedCues, setParsedCues] = useState<Array<{ question_id?: string | null; group_id?: string | null; label: string; start_ms: number; end_ms: number; valid: boolean; error?: string }>>([]);

  // Bilingual Import Modal & State
  const [showBilingualModal, setShowBilingualModal] = useState(false);
  const [bilingualJson, setBilingualJson] = useState('');
  const [bilingualPreview, setBilingualPreview] = useState<{ questionCount: number; groupCount: number; errors: string[] } | null>(null);
  const [importingBilingual, setImportingBilingual] = useState(false);

  // Fetch cues if test is in single_track mode
  const fetchCues = async () => {
    const res = await getListeningCues(testId);
    if (res.success && res.data) {
      setCues(res.data);
    }
  };

  useEffect(() => {
    if (test?.listening_audio_mode === 'single_track') {
      fetchCues();
    }
  }, [testId, test?.listening_audio_mode]);

  const metrics = useMemo(() => getMediaCompleteness(groups, questions, test, cues), [groups, questions, test, cues]);

  const handleModeChange = async (mode: 'segmented' | 'single_track') => {
    setError(null);
    setSuccessMsg(null);
    const res = await updateTestListeningAudioMode(testId, mode);
    if (res.success) {
      setSuccessMsg(`Đã đổi nguồn audio thành ${mode === 'segmented' ? 'Audio cắt theo câu/nhóm' : '1 file Listening Q1-100 + Cue Map'}`);
      onMediaUpdated();
    } else {
      setError(res.error || 'Lỗi khi cập nhật nguồn audio.');
    }
  };

  const handleUploadSingleTrack = async (file: File) => {
    setLoading(prev => ({ ...prev, singleTrack: true }));
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await uploadToeicListeningTrack(testId, file);
      if (res.success) {
        setSuccessMsg('Đã upload file audio tổng Listening thành công!');
        onMediaUpdated();
      } else {
        setError(res.error || 'Lỗi khi upload single track.');
      }
    } catch (err: any) {
      setError('Lỗi hệ thống khi upload single track.');
    } finally {
      setLoading(prev => ({ ...prev, singleTrack: false }));
    }
  };

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

  // ============================================================
  // BULK MEDIA IMPORT PARSER & RUNNER
  // ============================================================
  const updateBulkMatches = (
    files: Array<{ name: string; file: File }>,
    mode: 'ori' | 'sequential',
    seqType: SequentialMediaType
  ) => {
    const isPublished = Boolean(test?.is_published);
    const getRange = (gId: string) => getToeicGroupQuestionRange(gId, questions);

    if (mode === 'ori') {
      const matchedItems: typeof bulkFiles = [];
      const cleanFiles = files.filter(f => !isMacNoiseFile(f.name));

      cleanFiles.forEach(({ name, file }) => {
        const cleanName = name.toLowerCase().trim();
        const basename = cleanName.split('/').pop() || cleanName;

        // Part 1 Image: q001.jpg, q1.png, etc.
        const imgMatch = basename.match(/^q0*([1-6])\.(jpg|jpeg|png|webp)$/);
        if (imgMatch) {
          const qNum = parseInt(imgMatch[1], 10);
          const q = questions.find(item => item.question_number === qNum && item.part === 'part1');
          if (q && q.id) {
            const exists = Boolean(q.image_url);
            matchedItems.push({
              name,
              file,
              type: 'image',
              targetType: 'question',
              targetId: q.id,
              targetLabel: `Q${qNum} (Hình ảnh)`,
              currentExists: exists,
              action: isPublished && exists ? 'skip' : 'upload',
              status: isPublished && exists ? 'skip' : 'ready'
            });
            return;
          }
        }

        // Part 1 & 2 Audio: q001.mp3, q007.mp3, etc.
        const audioMatch = basename.match(/^q0*([1-9]|[12][0-9]|3[01])\.(mp3|wav|ogg|m4a)$/);
        if (audioMatch) {
          const qNum = parseInt(audioMatch[1], 10);
          const q = questions.find(item => item.question_number === qNum);
          if (q && q.id) {
            const exists = Boolean(q.audio_url);
            matchedItems.push({
              name,
              file,
              type: 'audio',
              targetType: 'question',
              targetId: q.id,
              targetLabel: `Q${qNum} (Audio)`,
              currentExists: exists,
              action: isPublished && exists ? 'skip' : 'upload',
              status: isPublished && exists ? 'skip' : 'ready'
            });
            return;
          }
        }

        // Part 3 & 4 Group Audio: q032-034.mp3, q32-34.mp3, etc.
        const groupMatch = basename.match(/^q0*([3-9][0-9]|100)-0*([3-9][0-9]|100)\.(mp3|wav|ogg|m4a)$/);
        if (groupMatch) {
          const startQ = parseInt(groupMatch[1], 10);
          const endQ = parseInt(groupMatch[2], 10);
          const g = groups.find(grp => {
            const range = getRange(grp.id!);
            return range.min === startQ && range.max === endQ;
          });
          if (g && g.id) {
            const exists = Boolean(g.audio_url);
            matchedItems.push({
              name,
              file,
              type: 'audio',
              targetType: 'group',
              targetId: g.id,
              targetLabel: `Q${startQ}–${endQ} Group Audio`,
              currentExists: exists,
              action: isPublished && exists ? 'skip' : 'upload',
              status: isPublished && exists ? 'skip' : 'ready'
            });
            return;
          }
        }

        // Unmatched ORI file
        matchedItems.push({
          name,
          file,
          type: 'audio',
          targetType: 'none',
          targetLabel: 'Không khớp tên ORI',
          currentExists: false,
          action: 'invalid',
          status: 'invalid',
          error: 'Tên file không đúng chuẩn ORI (ví dụ q001.jpg, q001.mp3, q032-034.mp3)'
        });
      });

      setBulkFiles(matchedItems);
      setSequentialResult(null);
    } else {
      const result = mapSequentialMediaFiles(files, seqType, questions, groups, getRange, isPublished);
      setSequentialResult(result);
      setBulkFiles(result.items as any);
    }
  };

  const processRawFileList = async (files: FileList | File[]) => {
    const fileArray: Array<{ name: string; file: File }> = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.name.endsWith('.zip')) {
        try {
          const zip = await JSZip.loadAsync(f);
          for (const filename of Object.keys(zip.files)) {
            const zipEntry = zip.files[filename];
            if (!zipEntry.dir) {
              const blob = await zipEntry.async('blob');
              const extractedFile = new File([blob], filename.split('/').pop() || filename);
              fileArray.push({ name: extractedFile.name, file: extractedFile });
            }
          }
        } catch (err) {
          console.error('ZIP extract error:', err);
        }
      } else {
        fileArray.push({ name: f.name, file: f });
      }
    }

    setRawFiles(fileArray);
    const sugg = detectSequentialMediaSuggestion(fileArray);
    setSuggestion(sugg);

    // If suggestion detected, default to sequential mode with suggested type!
    let initialMode: 'ori' | 'sequential' = bulkMatchMode;
    let initialType: SequentialMediaType = sequentialMediaType;

    if (sugg.mediaType) {
      initialMode = 'sequential';
      initialType = sugg.mediaType;
      setBulkMatchMode('sequential');
      setSequentialMediaType(sugg.mediaType);
    }

    updateBulkMatches(fileArray, initialMode, initialType);
    setShowBulkModal(true);
  };

  const handleMatchModeChange = (mode: 'ori' | 'sequential') => {
    setBulkMatchMode(mode);
    updateBulkMatches(rawFiles, mode, sequentialMediaType);
  };

  const handleSequentialTypeChange = (type: SequentialMediaType) => {
    setSequentialMediaType(type);
    updateBulkMatches(rawFiles, 'sequential', type);
  };

  const executeBulkUpload = async () => {
    setBulkProcessing(true);
    const toUpload = bulkFiles.filter(f => f.action === 'upload' && f.status !== 'success');
    
    // Concurrency pool (max 3)
    const queue = [...toUpload];
    const workerCount = Math.min(3, queue.length);

    const runWorker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        setBulkFiles(prev => prev.map(f => f.name === item.name ? { ...f, status: 'uploading' } : f));

        let res;
        if (!item.targetId) {
          res = { success: false, error: 'Thiếu ID đối tượng target' };
        } else if (item.targetType === 'question') {
          res = await uploadQuestionMedia(item.targetId, item.file, item.type);
        } else {
          res = await uploadGroupMedia(item.targetId, item.file, item.type);
        }

        if (res.success) {
          setBulkFiles(prev => prev.map(f => f.name === item.name ? { ...f, status: 'success' } : f));
        } else {
          setBulkFiles(prev => prev.map(f => f.name === item.name ? { ...f, status: 'failed', error: res.error } : f));
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }).map(() => runWorker()));
    setBulkProcessing(false);
    onMediaUpdated();
  };

  // ============================================================
  // CUE MAP PARSER
  // ============================================================
  const parseCueCsv = (text: string) => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const results: typeof parsedCues = [];

    lines.forEach(line => {
      if (line.startsWith('scope') || line.startsWith('#')) return; // Header or comment
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 5) return;

      const [scope, startQStr, endQStr, startMsStr, endMsStr] = parts;
      const startQ = parseInt(startQStr, 10);
      const endQ = parseInt(endQStr, 10);
      const startMs = parseInt(startMsStr, 10);
      const endMs = parseInt(endMsStr, 10);

      if (isNaN(startMs) || isNaN(endMs) || startMs < 0 || endMs <= startMs) {
        results.push({ label: `${startQStr}-${endQStr}`, start_ms: startMs, end_ms: endMs, valid: false, error: 'Thời gian không hợp lệ' });
        return;
      }

      if (scope === 'question') {
        const q = questions.find(item => item.question_number === startQ);
        if (q && q.id && (q.part === 'part1' || q.part === 'part2')) {
          results.push({ question_id: q.id, label: `Q${startQ}`, start_ms: startMs, end_ms: endMs, valid: true });
        } else {
          results.push({ label: `Q${startQ}`, start_ms: startMs, end_ms: endMs, valid: false, error: 'Không tìm thấy câu hỏi Part 1/2' });
        }
      } else if (scope === 'group') {
        const g = groups.find(grp => {
          const range = getToeicGroupQuestionRange(grp.id!, questions);
          return range.min === startQ && range.max === endQ;
        });
        if (g && g.id && (g.part === 'part3' || g.part === 'part4')) {
          results.push({ group_id: g.id, label: `Q${startQ}–${endQ}`, start_ms: startMs, end_ms: endMs, valid: true });
        } else {
          results.push({ label: `Q${startQ}–${endQ}`, start_ms: startMs, end_ms: endMs, valid: false, error: 'Không tìm thấy nhóm câu hỏi Part 3/4' });
        }
      }
    });

    setParsedCues(results);
  };

  const handleApplyCues = async () => {
    const validCues = parsedCues.filter(c => c.valid).map(c => ({
      question_id: c.question_id || null,
      group_id: c.group_id || null,
      start_ms: c.start_ms,
      end_ms: c.end_ms
    }));

    if (validCues.length === 0) return;
    setLoading(prev => ({ ...prev, cues: true }));
    const res = await upsertListeningCues(testId, validCues);
    if (res.success) {
      setSuccessMsg(`Đã cập nhật ${res.count} cue timestamps thành công!`);
      setShowCueModal(false);
      fetchCues();
      onMediaUpdated();
    } else {
      setError(res.error || 'Lỗi khi lưu cue map.');
    }
    setLoading(prev => ({ ...prev, cues: false }));
  };

  // ============================================================
  // BILINGUAL IMPORT PARSER
  // ============================================================
  const handleParseBilingualJson = (text: string) => {
    setBilingualJson(text);
    try {
      const data = JSON.parse(text);
      const errors: string[] = [];
      let qCount = 0;
      let gCount = 0;

      if (data.questions && Array.isArray(data.questions)) {
        data.questions.forEach((q: any) => {
          if (q.correct_answer || q.explanation) {
            errors.push(`Cảnh báo: Payload chứa correct_answer/explanation tại câu #${q.question_number} (đã bị bỏ qua).`);
          }
          if (q.options_vi && Array.isArray(q.options_vi)) {
            const targetQ = questions.find(item => item.question_number === q.question_number);
            if (targetQ) {
              const expectedCount = targetQ.part === 'part2' ? 3 : 4;
              if (q.options_vi.length !== expectedCount) {
                errors.push(`Câu #${q.question_number} (${targetQ.part}): Số lượng lựa chọn dịch (${q.options_vi.length}) không khớp với kỳ vọng (${expectedCount}).`);
              }
            }
          }
          qCount++;
        });
      }

      if (data.groups && Array.isArray(data.groups)) {
        data.groups.forEach((g: any) => {
          if (g.start_question && g.end_question) {
            const targetG = groups.find(grp => {
              const range = getToeicGroupQuestionRange(grp.id!, questions);
              return range.min === g.start_question && range.max === g.end_question;
            });
            if (targetG) g.id = targetG.id;
          }
          gCount++;
        });
      }

      setBilingualPreview({ questionCount: qCount, groupCount: gCount, errors });
    } catch (err) {
      setBilingualPreview({ questionCount: 0, groupCount: 0, errors: ['Cú pháp JSON không hợp lệ.'] });
    }
  };

  const handleExecuteBilingualImport = async () => {
    if (!bilingualJson) return;
    setImportingBilingual(true);
    setError(null);
    try {
      const payload = JSON.parse(bilingualJson);
      // Clean safety check: strip correct_answer and explanation client-side
      if (payload.questions) {
        payload.questions.forEach((q: any) => {
          delete q.correct_answer;
          delete q.explanation;
        });
      }
      const res = await importBilingualContent(testId, payload);
      if (res.success) {
        setSuccessMsg(`Đã cập nhật bản dịch cho ${res.updatedQuestions} câu hỏi và ${res.updatedGroups} nhóm câu hỏi!`);
        setShowBilingualModal(false);
        onMediaUpdated();
      } else {
        setError(res.error || 'Lỗi khi import bản dịch.');
      }
    } catch (err: any) {
      setError('Lỗi khi xử lý dữ liệu bản dịch.');
    } finally {
      setImportingBilingual(false);
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
    useEffect(() => {
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

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* AUDIO SOURCE MODE SELECTOR */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-3">
        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-ori-600" />
          Cấu hình Nguồn Audio Listening
        </h4>
        <div className="flex flex-wrap gap-4 text-xs font-bold">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
            <input
              type="radio"
              name="audio_mode"
              checked={(test?.listening_audio_mode || 'segmented') === 'segmented'}
              onChange={() => handleModeChange('segmented')}
              className="text-ori-600 focus:ring-ori-500"
            />
            <span>Audio đã cắt theo câu / nhóm (Segmented)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
            <input
              type="radio"
              name="audio_mode"
              checked={test?.listening_audio_mode === 'single_track'}
              onChange={() => handleModeChange('single_track')}
              className="text-ori-600 focus:ring-ori-500"
            />
            <span>1 file Listening Q1–100 + Cue Map (Single Track)</span>
          </label>
        </div>
      </div>

      {/* ACTION TOOLBAR: BULK MEDIA & BILINGUAL IMPORT */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-2">
          <label className="cursor-pointer text-xs font-extrabold px-4 py-2.5 bg-ori-600 hover:bg-ori-500 text-white rounded-xl flex items-center gap-2 shadow-sm transition-all">
            <Zap className="w-4 h-4" />
            ⚡ Bulk Import Media (Zip / Folders)
            <input
              type="file"
              multiple
              accept=".zip,.mp3,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => { if (e.target.files?.length) processRawFileList(e.target.files); }}
            />
          </label>

          {test?.listening_audio_mode === 'single_track' && (
            <button
              type="button"
              onClick={() => setShowCueModal(true)}
              className="text-xs font-extrabold px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              <FileCode className="w-4 h-4" />
              Import Cue CSV Map
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowBilingualModal(true)}
          className="text-xs font-extrabold px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl flex items-center gap-2 shadow-sm transition-all"
        >
          <FileCode className="w-4 h-4" />
          🌐 Import bản dịch (Bilingual JSON)
        </button>
      </div>

      {/* SINGLE TRACK AUDIO PANEL */}
      {test?.listening_audio_mode === 'single_track' && (
        <div className="p-4 bg-sky-50/60 border border-sky-200/60 rounded-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-extrabold text-sky-900 flex items-center gap-2">
                <Music className="w-4 h-4 text-sky-600" />
                Single Listening Track (Q1-100 Audio)
              </h4>
              <p className="text-xs text-sky-700 mt-0.5">
                File audio duy nhất chứa toàn bộ phần thi nghe Listening từ Câu 1 đến Câu 100.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-44">
                <MediaPreview url={test?.listening_audio_url} type="audio" />
              </div>
              <label className="cursor-pointer text-xs font-bold px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl flex items-center gap-1.5 transition-colors">
                {loading.singleTrack ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {test?.listening_audio_url ? 'Thay thế Track' : 'Upload listening-full.mp3'}
                <input
                  type="file"
                  accept="audio/mpeg,audio/mp4,audio/wav"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleUploadSingleTrack(e.target.files[0]); }}
                  disabled={loading.singleTrack}
                />
              </label>
            </div>
          </div>

          {/* CUE STATS SUMMARY */}
          <div className="pt-2 border-t border-sky-200/50 flex items-center justify-between text-xs">
            <span className="font-bold text-sky-800">Cues đã cấu hình: {cues.length} items</span>
            <button
              type="button"
              onClick={() => setShowCueModal(true)}
              className="font-bold text-sky-600 hover:underline"
            >
              Chỉnh sửa / Nhập mới Cue Map CSV
            </button>
          </div>
        </div>
      )}

      {/* METRICS SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {renderMetricCard('Part 1 Ảnh', metrics.part1Images, <ImageIcon className="w-3.5 h-3.5" />, true)}
        {metrics.listeningAudioMode === 'single_track' ? (
          <>
            {renderMetricCard('Single Track', metrics.singleTrackAudio!, <Music className="w-3.5 h-3.5" />, true)}
            {renderMetricCard('Part 1 Cues', metrics.cuesCoverage?.part1!, <FileCode className="w-3.5 h-3.5" />, true)}
            {renderMetricCard('Part 2 Cues', metrics.cuesCoverage?.part2!, <FileCode className="w-3.5 h-3.5" />, true)}
            {renderMetricCard('Part 3/4 Cues', {
              ready: (metrics.cuesCoverage?.part3.ready || 0) + (metrics.cuesCoverage?.part4.ready || 0),
              expected: (metrics.cuesCoverage?.part3.expected || 0) + (metrics.cuesCoverage?.part4.expected || 0),
              missing: [...(metrics.cuesCoverage?.part3.missing || []), ...(metrics.cuesCoverage?.part4.missing || [])]
            }, <FileCode className="w-3.5 h-3.5" />, true)}
          </>
        ) : (
          <>
            {renderMetricCard('Part 1 Audio', metrics.part1Audio, <Music className="w-3.5 h-3.5" />, true)}
            {renderMetricCard('Part 2 Audio', metrics.part2Audio, <Music className="w-3.5 h-3.5" />, true)}
            {renderMetricCard('Part 3 Audio', metrics.part3Audio, <Music className="w-3.5 h-3.5" />, true)}
            {renderMetricCard('Part 4 Audio', metrics.part4Audio, <Music className="w-3.5 h-3.5" />, true)}
          </>
        )}
      </div>

      {!metrics.publishReady && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 text-red-800">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="text-sm font-bold">
            <p>Đề thi chưa đủ điều kiện xuất bản (thiếu media bắt buộc cho chế độ {metrics.listeningAudioMode}).</p>
          </div>
        </div>
      )}

      {/* Part 1 Questions */}
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

              {test?.listening_audio_mode === 'segmented' && (
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
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Part 2 Questions */}
      {test?.listening_audio_mode === 'segmented' && (
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
      )}

      {/* Part 3 & 4 Groups */}
      {test?.listening_audio_mode === 'segmented' && (['part3', 'part4'] as const).map(part => {
        const partGroups = sortGroupsByQuestionRange(
          groups.filter(g => g.part === part && g.is_active !== false),
          questions
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
                          {loading[g.id!] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} Audio
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

      {/* BULK MEDIA CONFIRMATION MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-4xl w-full space-y-4 max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-ori-600" />
                Xem trước Bulk Media Import ({rawFiles.length} file đã chọn)
              </h3>
            </div>

            {/* MATCHING MODE SELECTOR */}
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center gap-6 font-bold text-slate-800">
                <span className="text-slate-500 font-extrabold uppercase text-[11px]">MATCHING MODE:</span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bulkMode"
                    checked={bulkMatchMode === 'ori'}
                    onChange={() => handleMatchModeChange('ori')}
                    className="text-ori-600 focus:ring-ori-500"
                  />
                  <span>Tự nhận diện tên chuẩn ORI (q001.jpg, q001.mp3, q032-034.mp3)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bulkMode"
                    checked={bulkMatchMode === 'sequential'}
                    onChange={() => handleMatchModeChange('sequential')}
                    className="text-ori-600 focus:ring-ori-500"
                  />
                  <span>File tuần tự / tên gốc (E26-T01-01.mp3, E26-T01-02.mp3...)</span>
                </label>
              </div>

              {/* SEQUENTIAL MEDIA TYPE SELECTOR */}
              {bulkMatchMode === 'sequential' && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="flex items-center gap-4 flex-wrap font-bold text-slate-700">
                    <span className="text-slate-500 font-extrabold uppercase text-[11px]">LOẠI MEDIA:</span>
                    {(
                      [
                        { key: 'p1_image', label: 'Part 1 — Hình ảnh (1–6)' },
                        { key: 'p1_audio', label: 'Part 1 — Audio (1–6)' },
                        { key: 'p2_audio', label: 'Part 2 — Audio (1–25)' },
                        { key: 'p3_audio', label: 'Part 3 — Audio nhóm (1–13)' },
                        { key: 'p4_audio', label: 'Part 4 — Audio nhóm (1–10)' },
                      ] as const
                    ).map(item => (
                      <label key={item.key} className="flex items-center gap-1.5 cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-ori-400">
                        <input
                          type="radio"
                          name="seqType"
                          checked={sequentialMediaType === item.key}
                          onChange={() => handleSequentialTypeChange(item.key)}
                          className="text-ori-600 focus:ring-ori-500"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* SMART SUGGESTION BANNER */}
              {suggestion.message && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center justify-between text-amber-800 font-medium">
                  <span className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600" />
                    {suggestion.message}
                  </span>
                  {suggestion.mediaType && (
                    <button
                      type="button"
                      onClick={() => {
                        handleMatchModeChange('sequential');
                        handleSequentialTypeChange(suggestion.mediaType!);
                      }}
                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[11px] rounded-lg shadow-sm"
                    >
                      Áp dụng Gợi ý
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* SUMMARY COUNTERS BAR */}
            <div className="flex items-center gap-4 text-xs font-bold text-slate-600 bg-slate-100 p-2.5 rounded-xl flex-wrap">
              <span>Tổng file: <strong className="text-slate-900">{rawFiles.filter(f => !isMacNoiseFile(f.name)).length}</strong></span>
              <span>Sẵn sàng: <strong className="text-emerald-600">{bulkFiles.filter(f => f.action === 'upload' && f.status !== 'failed').length}</strong></span>
              <span>Đã có (Bỏ qua): <strong className="text-slate-500">{bulkFiles.filter(f => f.action === 'skip').length}</strong></span>
              <span>Không hợp lệ: <strong className="text-red-600">{bulkFiles.filter(f => f.status === 'invalid').length}</strong></span>
              <span>Trùng thứ tự: <strong className="text-amber-600">{bulkFiles.filter(f => f.status === 'conflict').length}</strong></span>
            </div>

            {/* MISSING SEQUENCES WARNING */}
            {sequentialResult && sequentialResult.counters.missingSequences.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5 text-xs text-orange-800 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0" />
                <span>Cảnh báo: Thiếu các số thứ tự trong dãy: #{sequentialResult.counters.missingSequences.join(', #')}</span>
              </div>
            )}

            {/* PREVIEW TABLE */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl space-y-1">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0 font-extrabold text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">FILE GỐC</th>
                    <th className="p-2.5 w-16 text-center">#</th>
                    <th className="p-2.5">TỰ GẮN VÀO</th>
                    <th className="p-2.5 text-right">TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {bulkFiles.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 italic">Không tìm thấy file nào khớp</td>
                    </tr>
                  ) : (
                    bulkFiles.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-bold text-slate-800 break-all">{item.name}</td>
                        <td className="p-2.5 text-center font-bold text-slate-500">{item.sequence ?? '—'}</td>
                        <td className="p-2.5 font-extrabold text-ori-600">{item.targetLabel}</td>
                        <td className="p-2.5 text-right whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'success'
                                ? 'bg-emerald-100 text-emerald-700'
                                : item.status === 'ready'
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                                : item.status === 'skip'
                                ? 'bg-slate-100 text-slate-600'
                                : item.status === 'conflict'
                                ? 'bg-amber-100 text-amber-800'
                                : item.status === 'invalid'
                                ? 'bg-red-100 text-red-700'
                                : item.status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {item.status === 'uploading'
                              ? 'Đang upload...'
                              : item.status === 'ready'
                              ? '✓ Sẵn sàng'
                              : item.status === 'skip'
                              ? 'Đã có (Bỏ qua)'
                              : item.status === 'conflict'
                              ? '✕ Trùng thứ tự'
                              : item.status === 'invalid'
                              ? `✕ ${item.error || 'Không hợp lệ'}`
                              : item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 text-xs font-extrabold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={executeBulkUpload}
                disabled={bulkProcessing || bulkFiles.filter(f => f.action === 'upload').length === 0}
                className="px-5 py-2 text-xs font-extrabold text-white bg-ori-600 rounded-xl hover:bg-ori-500 disabled:opacity-50 flex items-center gap-2"
              >
                {bulkProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận & Upload ({bulkFiles.filter(f => f.action === 'upload').length} items)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUE CSV MODAL */}
      {showCueModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-sky-600" />
              Import Cue CSV Map (Single Track Timestamps)
            </h3>

            <p className="text-xs text-slate-500">
              Định dạng CSV: <code>scope,start_question,end_question,start_ms,end_ms</code><br />
              Ví dụ:<br />
              <code>question,1,1,42000,55000</code><br />
              <code>group,32,34,735000,785000</code>
            </p>

            <textarea
              rows={8}
              value={cueCsvText}
              onChange={(e) => parseCueCsv(e.target.value)}
              placeholder="scope,start_question,end_question,start_ms,end_ms..."
              className="w-full p-3 font-mono text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />

            {parsedCues.length > 0 && (
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 text-xs space-y-1">
                {parsedCues.map((c, i) => (
                  <div key={i} className={`p-1.5 rounded-lg flex justify-between ${c.valid ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'}`}>
                    <span>{c.label} ({c.start_ms}ms - {c.end_ms}ms)</span>
                    <span className="font-bold">{c.valid ? '✓ Hợp lệ' : `✕ ${c.error}`}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCueModal(false)}
                className="px-4 py-2 text-xs font-extrabold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApplyCues}
                disabled={loading.cues || parsedCues.filter(c => c.valid).length === 0}
                className="px-5 py-2 text-xs font-extrabold text-white bg-sky-600 rounded-xl hover:bg-sky-500 disabled:opacity-50"
              >
                {loading.cues ? 'Đang lưu...' : `Lưu ${parsedCues.filter(c => c.valid).length} Cues`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BILINGUAL IMPORT MODAL */}
      {showBilingualModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full space-y-4 max-h-[85vh] flex flex-col shadow-2xl">
            <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-slate-800" />
              Import Nội dung Song ngữ (Bilingual JSON)
            </h3>

            <textarea
              rows={10}
              value={bilingualJson}
              onChange={(e) => handleParseBilingualJson(e.target.value)}
              placeholder='{"questions": [{"question_number": 101, "translation_vi": "...", "options_vi": ["...", "..."]}], "groups": [...]}'
              className="w-full p-3 font-mono text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none"
            />

            {bilingualPreview && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-slate-800">
                  Phát hiện: {bilingualPreview.questionCount} câu hỏi, {bilingualPreview.groupCount} nhóm câu hỏi.
                </p>
                {bilingualPreview.errors.map((err, i) => (
                  <p key={i} className="text-amber-600 italic">{err}</p>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBilingualModal(false)}
                className="px-4 py-2 text-xs font-extrabold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleExecuteBilingualImport}
                disabled={importingBilingual || !bilingualPreview || (bilingualPreview.questionCount === 0 && bilingualPreview.groupCount === 0)}
                className="px-5 py-2 text-xs font-extrabold text-white bg-slate-900 rounded-xl hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2"
              >
                {importingBilingual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Thực hiện Import Bản Dịch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
