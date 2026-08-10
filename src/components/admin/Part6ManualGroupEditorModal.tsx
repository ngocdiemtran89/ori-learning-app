import React, { useState, useEffect, useMemo } from 'react';
import { X, Save, AlertCircle, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase/client';

export interface Part6ManualGroupEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  testId: string;
  testTitle: string;
  existingQuestions: any[];
  existingGroups: any[];
  onUpdated: () => void;
}

const PART6_RANGES = [
  { label: 'Q131–134', start: 131, end: 134 },
  { label: 'Q135–138', start: 135, end: 138 },
  { label: 'Q139–142', start: 139, end: 142 },
  { label: 'Q143–146', start: 143, end: 146 },
];

interface QuestionOptionState {
  id: string;
  question_number: number;
  options: [string, string, string, string];
  options_vi: [string, string, string, string];
}

export const Part6ManualGroupEditorModal: React.FC<Part6ManualGroupEditorModalProps> = ({
  isOpen,
  onClose,
  testId: _testId,
  testTitle,
  existingQuestions,
  existingGroups,
  onUpdated,
}) => {
  const [selectedRangeIndex, setSelectedRangeIndex] = useState<number>(0);
  const [passageEn, setPassageEn] = useState<string>('');
  const [passageVi, setPassageVi] = useState<string>('');
  const [questionsState, setQuestionsState] = useState<QuestionOptionState[]>([]);
  
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const activeRange = PART6_RANGES[selectedRangeIndex];

  // Find target group for active range
  const targetGroup = useMemo(() => {
    if (!existingGroups || existingGroups.length === 0) return null;
    return existingGroups.find(g => {
      if (g.part !== 'part6') return false;
      if (typeof g.start_question === 'number') {
        return g.start_question === activeRange.start;
      }
      if (g.range === `${activeRange.start}-${activeRange.end}`) return true;
      return false;
    }) || existingGroups.find(g => g.part === 'part6') || null;
  }, [existingGroups, activeRange]);

  // Find target questions for active range
  const targetQuestions = useMemo(() => {
    if (!existingQuestions || existingQuestions.length === 0) return [];
    return existingQuestions
      .filter(q => q.part === 'part6' && q.question_number >= activeRange.start && q.question_number <= activeRange.end)
      .sort((a, b) => a.question_number - b.question_number);
  }, [existingQuestions, activeRange]);

  // Initialize form state when targetGroup or range changes
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    // Initialize group passage
    setPassageEn(targetGroup?.passage || '');
    setPassageVi(targetGroup?.passage_vi || '');

    // Initialize questions
    const qStates: QuestionOptionState[] = [];
    for (let qNum = activeRange.start; qNum <= activeRange.end; qNum++) {
      const q = targetQuestions.find(item => item.question_number === qNum);
      const enOptsArr = Array.isArray(q?.options) ? q.options : [];
      const viOptsArr = Array.isArray(q?.options_vi) ? q.options_vi : [];

      qStates.push({
        id: q?.id || '',
        question_number: qNum,
        options: [
          String(enOptsArr[0] || ''),
          String(enOptsArr[1] || ''),
          String(enOptsArr[2] || ''),
          String(enOptsArr[3] || ''),
        ],
        options_vi: [
          String(viOptsArr[0] || ''),
          String(viOptsArr[1] || ''),
          String(viOptsArr[2] || ''),
          String(viOptsArr[3] || ''),
        ],
      });
    }

    setQuestionsState(qStates);
    setIsDirty(false);
  }, [isOpen, selectedRangeIndex, targetGroup, targetQuestions]);

  if (!isOpen) return null;

  const handleSelectRange = (index: number) => {
    if (index === selectedRangeIndex) return;
    if (isDirty) {
      const confirmSwitch = window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn chuyển nhóm khác không?');
      if (!confirmSwitch) return;
    }
    setSelectedRangeIndex(index);
  };

  const handleCloseModal = () => {
    if (isDirty) {
      const confirmClose = window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn đóng không?');
      if (!confirmClose) return;
    }
    onClose();
  };

  const handleOptionChange = (qIndex: number, lang: 'en' | 'vi', optIndex: number, value: string) => {
    setQuestionsState(prev => {
      const updated = [...prev];
      const q = { ...updated[qIndex] };
      if (lang === 'en') {
        const newEnOpts = [...q.options] as [string, string, string, string];
        newEnOpts[optIndex] = value;
        q.options = newEnOpts;
      } else {
        const newViOpts = [...q.options_vi] as [string, string, string, string];
        newViOpts[optIndex] = value;
        q.options_vi = newViOpts;
      }
      updated[qIndex] = q;
      return updated;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!targetGroup) {
      setErrorMsg(`Không tìm thấy dữ liệu nhóm ${activeRange.label} trong cơ sở dữ liệu.`);
      return;
    }

    if (questionsState.some(q => !q.id)) {
      setErrorMsg(`Không tìm thấy đủ 4 câu hỏi (${activeRange.label}) trong hệ thống.`);
      return;
    }

    setSaving(true);
    try {
      // 1. Update Group passage & passage_vi
      const { error: groupErr } = await supabase
        .from('toeic_test_groups')
        .update({
          passage: passageEn.trim() || null,
          passage_vi: passageVi.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetGroup.id);

      if (groupErr) {
        throw new Error(`Lỗi cập nhật đoạn văn nhóm: ${groupErr.message}`);
      }

      // 2. Update 4 Questions options & options_vi
      for (const qState of questionsState) {
        const { error: qErr } = await supabase
          .from('toeic_test_questions')
          .update({
            options: qState.options,
            options_vi: qState.options_vi,
            updated_at: new Date().toISOString(),
          })
          .eq('id', qState.id);

        if (qErr) {
          throw new Error(`Lỗi cập nhật đáp án câu #${qState.question_number}: ${qErr.message}`);
        }
      }

      setIsDirty(false);
      setSuccessMsg(`Lưu thành công nội dung nhóm ${activeRange.label}!`);
      onUpdated();
    } catch (err: any) {
      console.error('[Part6ManualGroupEditor] Save error:', err);
      setErrorMsg(err.message || 'Lỗi khi lưu dữ liệu nhóm Part 6.');
    } finally {
      setSaving(false);
    }
  };

  const optionLabels = ['A', 'B', 'C', 'D'];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 text-purple-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base tracking-wide flex items-center gap-2">
                <span>✍️ NHẬP TAY NỘI DUNG PART 6</span>
                <span className="text-xs px-2 py-0.5 bg-purple-500/30 text-purple-300 rounded-full font-mono">
                  {testTitle}
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Chỉnh sửa đoạn văn (Passage EN/VI) và lựa chọn đáp án cho từng nhóm câu hỏi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SAFETY NOTICE BANNER */}
        <div className="px-6 py-2.5 bg-purple-50 border-b border-purple-100 text-purple-900 text-xs font-semibold flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Answer Key (đáp án đúng) được quản lý riêng và sẽ không bị thay đổi.</span>
          </div>
          {isDirty && (
            <span className="text-[11px] font-black text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> Có thay đổi chưa lưu
            </span>
          )}
        </div>

        {/* GROUP SELECTOR TABS */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 shrink-0 overflow-x-auto">
          <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mr-2 shrink-0">
            CHỌN NHÓM CÂU:
          </span>
          {PART6_RANGES.map((range, idx) => {
            const isSelected = idx === selectedRangeIndex;
            return (
              <button
                key={range.label}
                type="button"
                onClick={() => handleSelectRange(idx)}
                className={`px-4 py-2 text-xs font-black rounded-xl transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-purple-700 text-white shadow-xs scale-[1.02]'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{range.label}</span>
              </button>
            );
          })}
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SECTION 1: PASSAGE EN / VI SIDE BY SIDE */}
          <div className="space-y-2">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <span>ĐOẠN VĂN PART 6 ({activeRange.label})</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* PASSAGE EN */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-purple-900 block">
                  🇬🇧 PASSAGE TIẾNG ANH (KÈM VỊ TRÍ ------- {activeRange.start}.)
                </label>
                <textarea
                  rows={8}
                  value={passageEn}
                  onChange={e => {
                    setPassageEn(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder={`Riessler Landscaping has everything you need... ------- ${activeRange.start}.`}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                />
              </div>

              {/* PASSAGE VI */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-purple-900 block">
                  🇻🇳 BẢN DỊCH TIẾNG VIỆT ĐOẠN VĂN
                </label>
                <textarea
                  rows={8}
                  value={passageVi}
                  onChange={e => {
                    setPassageVi(e.target.value);
                    setIsDirty(true);
                  }}
                  placeholder="Riessler Landscaping có mọi thứ bạn cần..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono text-slate-800 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: 4 QUESTIONS CHOICES EDITOR */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              LỰA CHỌN ĐÁP ÁN SONG NGỮ CHO 4 CÂU ({activeRange.label})
            </h4>

            <div className="space-y-4">
              {questionsState.map((qState, qIdx) => (
                <div
                  key={qState.question_number}
                  className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <span className="font-extrabold text-sm text-purple-900">
                      Câu {qState.question_number}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                      (Không bắt buộc nhập question_text)
                    </span>
                  </div>

                  <div className="space-y-2">
                    {optionLabels.map((lbl, optIdx) => (
                      <div key={lbl} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                        {/* EN CHOICE */}
                        <div className="flex items-center gap-2">
                          <span className="w-6 font-extrabold text-slate-700 text-xs text-center shrink-0">
                            ({lbl})
                          </span>
                          <input
                            type="text"
                            value={qState.options[optIdx]}
                            onChange={e => handleOptionChange(qIdx, 'en', optIdx, e.target.value)}
                            placeholder={`English choice (${lbl})...`}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                          />
                        </div>

                        {/* VI CHOICE */}
                        <div className="flex items-center gap-2">
                          <span className="w-6 font-bold text-slate-400 text-xs text-center shrink-0">
                            ({lbl})
                          </span>
                          <input
                            type="text"
                            value={qState.options_vi[optIdx]}
                            onChange={e => handleOptionChange(qIdx, 'vi', optIdx, e.target.value)}
                            placeholder={`Bản dịch tiếng Việt (${lbl})...`}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleCloseModal}
            className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-extrabold text-xs rounded-xl transition-all"
          >
            Đóng / Hủy
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-all flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : `💾 LƯU NHÓM ${activeRange.label}`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
