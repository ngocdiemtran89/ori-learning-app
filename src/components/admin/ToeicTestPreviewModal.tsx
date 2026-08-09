import React, { useState } from 'react';
import { X, Headphones, BookOpen, FileText } from 'lucide-react';
import { CANONICAL_TOEIC_PARTS, TOEIC_FULL_TEST_STRUCTURE, CanonicalToeicPart } from '../../lib/toeic/testStructure';

interface ToeicTestPreviewModalProps {
  testTitle: string;
  testCode?: string | null;
  groups: any[];
  questions: any[];
  onClose: () => void;
}

export const ToeicTestPreviewModal: React.FC<ToeicTestPreviewModalProps> = ({
  testTitle,
  testCode,
  groups,
  questions,
  onClose,
}) => {
  const [activePart, setActivePart] = useState<CanonicalToeicPart>('part1');
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const partQuestions = questions
    .filter((q) => q.is_active === true && q.part === activePart)
    .sort((a, b) => a.question_number - b.question_number);

  const partGroups = groups.filter((g) => g.is_active === true && g.part === activePart);

  const handleSelectAnswer = (qNum: number, opt: string) => {
    if (isSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [qNum]: opt }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <span className="px-2.5 py-0.5 bg-ori-500/20 text-ori-300 border border-ori-500/30 font-extrabold text-[10px] uppercase rounded-full inline-block mb-1">
              Admin Preview (No side effects)
            </span>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-ori-400" /> {testTitle} {testCode ? `(${testCode})` : ''}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Part Tabs */}
        <div className="bg-slate-100 p-2 flex items-center gap-1 border-b border-slate-200 overflow-x-auto shrink-0">
          {CANONICAL_TOEIC_PARTS.map((pKey) => {
            const count = questions.filter((q) => q.is_active === true && q.part === pKey).length;
            const isSelected = activePart === pKey;
            return (
              <button
                key={pKey}
                onClick={() => setActivePart(pKey)}
                className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-white text-ori-600 shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
              >
                <span>{pKey.toUpperCase()}</span>
                <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 text-[10px] rounded-full font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              {activePart.startsWith('part1') || activePart.startsWith('part2') || activePart.startsWith('part3') || activePart.startsWith('part4') ? (
                <Headphones className="w-4 h-4 text-purple-600" />
              ) : (
                <FileText className="w-4 h-4 text-emerald-600" />
              )}
              {TOEIC_FULL_TEST_STRUCTURE[activePart].nameVi}
            </h3>

            <div className="flex items-center gap-2">
              {isSubmitted ? (
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-extrabold rounded-xl"
                >
                  Thử lại
                </button>
              ) : (
                <button
                  onClick={() => setIsSubmitted(true)}
                  className="px-3 py-1.5 bg-ori-600 text-white text-xs font-extrabold rounded-xl shadow-xs"
                >
                  Kiểm tra đáp án
                </button>
              )}
            </div>
          </div>

          {partQuestions.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-400 font-bold">
              Chưa có câu hỏi nào trong {activePart.toUpperCase()}.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Groups with stimulus */}
              {partGroups.map((group) => {
                const groupQs = partQuestions.filter((q) => q.group_id === group.id);
                if (groupQs.length === 0 && !group.passage && !group.audio_url && !group.image_url) return null;

                return (
                  <div key={group.id} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                    {group.title && <h4 className="text-xs font-extrabold text-slate-900">{group.title}</h4>}
                    {group.instruction && <p className="text-xs text-slate-500 italic">{group.instruction}</p>}

                    {group.audio_url && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1">
                        <span className="text-[10px] font-extrabold text-purple-700 uppercase flex items-center gap-1">
                          <Headphones className="w-3.5 h-3.5" /> File Âm Thanh
                        </span>
                        <audio controls src={group.audio_url} className="w-full h-8" />
                      </div>
                    )}

                    {group.image_url && (
                      <div className="max-w-md mx-auto rounded-xl overflow-hidden border border-slate-200">
                        <img src={group.image_url} alt="Stimulus" className="max-h-64 object-contain mx-auto" />
                      </div>
                    )}

                    {group.passage && (
                      <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs font-mono whitespace-pre-line leading-relaxed text-slate-800">
                        {group.passage}
                      </div>
                    )}

                    {/* Part 7 Document Array */}
                    {Array.isArray(group.documents) && group.documents.length > 0 && (
                      <div className="space-y-3">
                        {group.documents.map((doc: any, dIdx: number) => (
                          <div key={dIdx} className="p-4 bg-white rounded-xl border border-slate-200 space-y-2">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                              Tài liệu #{dIdx + 1}: {doc.document_type || 'Văn bản'}
                            </span>
                            {doc.title && <h5 className="text-xs font-bold text-slate-900">{doc.title}</h5>}
                            {doc.body && <div className="text-xs font-mono whitespace-pre-line leading-relaxed text-slate-800">{doc.body}</div>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Render questions inside group */}
                    <div className="space-y-4 pt-2">
                      {groupQs.map((q) => renderQuestionRow(q))}
                    </div>
                  </div>
                );
              })}

              {/* Ungrouped questions (Part 5 or standalone) */}
              {partQuestions
                .filter((q) => !q.group_id)
                .map((q) => renderQuestionRow(q))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function renderQuestionRow(q: any) {
    const selected = userAnswers[q.question_number];
    const isCorrect = isSubmitted && selected === q.correct_answer;

    return (
      <div
        key={q.id}
        className={`p-4 rounded-xl border transition-all ${
          isSubmitted
            ? isCorrect
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-rose-50/60 border-rose-300'
            : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-start justify-between">
          <span className="font-extrabold text-xs text-ori-600 block mb-1">
            Câu #{q.question_number}
          </span>
          {isSubmitted && (
            <span
              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                isCorrect
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}
            >
              {isCorrect ? 'Đúng' : `Sai (Đáp án: ${q.correct_answer})`}
            </span>
          )}
        </div>

        {q.question_text && <p className="text-xs font-bold text-slate-900 mb-3">{q.question_text}</p>}

        {q.image_url && (
          <div className="mb-3 max-w-sm">
            <img src={q.image_url} alt={`Câu ${q.question_number}`} className="max-h-40 object-contain rounded-lg border" />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Array.isArray(q.options) &&
            q.options.map((opt: string, oIdx: number) => {
              const isSelected = selected === opt;
              const isOptionCorrect = isSubmitted && q.correct_answer && q.correct_answer.charCodeAt(0) - 65 === oIdx;

              return (
                <button
                  key={oIdx}
                  type="button"
                  onClick={() => handleSelectAnswer(q.question_number, opt)}
                  className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all ${
                    isSelected
                      ? isSubmitted
                        ? isCorrect
                          ? 'bg-emerald-500 text-white border-emerald-600 font-bold'
                          : 'bg-rose-500 text-white border-rose-600 font-bold'
                        : 'bg-ori-600 text-white border-ori-600 font-bold'
                      : isOptionCorrect
                      ? 'bg-emerald-100 border-emerald-400 text-emerald-900 font-extrabold'
                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
        </div>

        {isSubmitted && q.explanation && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
            <strong className="block font-bold">Giải thích:</strong>
            <span>{q.explanation}</span>
          </div>
        )}
      </div>
    );
  }
};
