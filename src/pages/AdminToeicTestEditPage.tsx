import React, { useState, useEffect } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  BookOpen,
  Layers,
  Sparkles,
} from 'lucide-react';
import { LoadingState } from '../components/ui/LoadingState';
import {
  getAdminToeicTest,
  createToeicTest,
  updateToeicTest,
  getToeicTestGroups,
  saveToeicTestGroup,
  setToeicTestGroupActive,
  getToeicTestQuestions,
  saveToeicTestQuestion,
  setToeicTestQuestionActive,
} from '../lib/supabase/adminTestBank';
import { validateToeicTestForPublish } from '../lib/cms/testBankValidation';
import {
  CANONICAL_TOEIC_PARTS,
  TOEIC_FULL_TEST_STRUCTURE,
  CanonicalToeicPart,
  getPartSummary,
  expectedOptionCountForPart,
} from '../lib/toeic/testStructure';
import { Image as ImageIcon } from 'lucide-react';
import { MediaManagerTab } from '../components/admin/MediaManagerTab';
import { SafeAnswerKeyImporterModal } from '../components/admin/AnswerKeyImporterModal';
import { SafeScriptBilingualManagerModal } from '../components/admin/ScriptBilingualManagerModal';
import { safeOptionText, hasOptionText } from '../lib/cms/toeicContentCompleteness';

export class AdminTestEditErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AdminTestEditErrorBoundary caught exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm max-w-2xl mx-auto text-center space-y-4 my-8">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
            ⚠️
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Trang chỉnh sửa đề thi gặp lỗi giao diện
          </h2>
          <p className="text-xs text-slate-600">
            {this.state.error?.message || 'Không thể hiển thị chi tiết đề thi.'}
          </p>
          <p className="text-[11px] text-slate-400">
            Không có dữ liệu nào bị ảnh hưởng hoặc bị xóa.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-4 py-2 bg-ori-600 hover:bg-ori-700 text-white font-extrabold text-xs rounded-xl transition-colors"
            >
              THỬ TẢI LẠI
            </button>
            <NavLink
              to="/admin/content/test-bank"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition-colors"
            >
              QUAY LẠI TEST BANK
            </NavLink>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AdminToeicTestEditPageInner: React.FC = () => {
  const { testId } = useParams<{ testId?: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(testId);

  // Answer Key Importer Modal State
  const [showAnswerKeyModal, setShowAnswerKeyModal] = useState<boolean>(false);
  // Script & Bilingual Manager Modal State
  const [showScriptBilingualModal, setShowScriptBilingualModal] = useState<boolean>(false);

  // Header State
  const [title, setTitle] = useState<string>('');
  const [slug, setSlug] = useState<string>('');
  const [testCode, setTestCode] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [testType, setTestType] = useState<'full' | 'mini' | 'custom'>('full');
  const [sortOrder, setSortOrder] = useState<number>(1);
  const [isPublished, setIsPublished] = useState<boolean>(false);
  const [listeningAudioMode, setListeningAudioMode] = useState<'segmented' | 'single_track'>('segmented');
  const [listeningAudioUrl, setListeningAudioUrl] = useState<string | null>(null);

  // Groups & Questions State
  const [groups, setGroups] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);

  // Active Tab
  const [activePart, setActivePart] = useState<CanonicalToeicPart | 'media'>('part1');

  // UI / Form State
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Editing Group modal/form inline state
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<any>({
    part: 'part1',
    group_type: 'photo',
    title: '',
    instruction: '',
    passage: '',
    transcript: '',
    audio_url: '',
    image_url: '',
    documents: [],
    instruction_vi: '',
    passage_vi: '',
  });

  // Editing Question modal/form inline state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState<any>({
    group_id: '',
    question_number: 1,
    part: 'part1',
    question_text: '',
    options: ['', '', '', ''],
    correct_answer: 'A',
    explanation: '',
    skill_tag: '',
    topic: '',
    difficulty: '',
    audio_url: '',
    image_url: '',
    translation_vi: '',
    options_vi: null,
  });

  useEffect(() => {
    if (isEditing && testId) {
      loadTestDetails();
    }
  }, [testId]);

  async function loadTestDetails() {
    setLoading(true);
    const [tRes, gRes, qRes] = await Promise.all([
      getAdminToeicTest(testId!),
      getToeicTestGroups(testId!),
      getToeicTestQuestions(testId!),
    ]);

    if (tRes.error || !tRes.data) {
      setFormError(tRes.error || 'Không tìm thấy đề thi.');
    } else {
      const t = tRes.data;
      setTitle(t.title);
      setSlug(t.slug);
      setTestCode(t.test_code || '');
      setDescription(t.description || '');
      setTestType((t.test_type as any) || 'full');
      setSortOrder(t.sort_order || 1);
      setIsPublished(t.is_published);
      setListeningAudioMode(t.listening_audio_mode || 'segmented');
      setListeningAudioUrl(t.listening_audio_url || null);
      setGroups(gRes.data || []);
      setQuestions(qRes.data || []);
    }
    setLoading(false);
  }

  // Generate slug automatically from title for new tests
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!isEditing) {
      const autoSlug = val
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-');
      setSlug(autoSlug);
    }
  };

  const handleSaveHeader = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    const input = {
      title,
      slug,
      test_code: testCode,
      description,
      test_type: testType,
      sort_order: sortOrder,
      is_published: isPublished,
    };

    if (isPublished) {
      const val = validateToeicTestForPublish(input, groups, questions);
      if (!val.isValid) {
        setFormError(`Không thể xuất bản (Publish): ${val.errors.join(' ')}`);
        setSaving(false);
        return;
      }
    }

    if (isEditing && testId) {
      const res = await updateToeicTest(testId, input);
      if (res.error) {
        setFormError(res.error);
      }
    } else {
      const res = await createToeicTest(input);
      if (res.error) {
        setFormError(res.error);
      } else if (res.data) {
        navigate(`/admin/content/test-bank/${res.data.id}/edit`);
      }
    }
    setSaving(false);
  };

  // Group Handlers
  const handleOpenNewGroup = (part: CanonicalToeicPart) => {
    let defaultGroupType = 'photo';
    if (part === 'part2') defaultGroupType = 'question_response';
    if (part === 'part3') defaultGroupType = 'conversation';
    if (part === 'part4') defaultGroupType = 'talk';
    if (part === 'part5') defaultGroupType = 'standalone';
    if (part === 'part6') defaultGroupType = 'text_completion';
    if (part === 'part7') defaultGroupType = 'reading_set';

    setEditingGroupId('NEW');
    setGroupForm({
      part,
      group_type: defaultGroupType,
      title: '',
      instruction: '',
      passage: '',
      transcript: '',
      audio_url: '',
      image_url: '',
      documents: [],
    });
  };

  const handleSaveGroup = async () => {
    if (!testId) {
      alert('Vui lòng lưu thông tin đề thi trước khi thêm nhóm câu hỏi.');
      return;
    }
    setSaving(true);
    const res = await saveToeicTestGroup(testId, {
      ...groupForm,
      id: editingGroupId === 'NEW' ? undefined : editingGroupId!,
    });

    if (res.error) {
      alert(res.error);
    } else {
      setEditingGroupId(null);
      const gRes = await getToeicTestGroups(testId);
      setGroups(gRes.data || []);
    }
    setSaving(false);
  };

  const handleToggleGroupActive = async (groupId: string, currentActive: boolean) => {
    const res = await setToeicTestGroupActive(groupId, !currentActive);
    if (res.error) alert(res.error);
    else {
      const gRes = await getToeicTestGroups(testId!);
      setGroups(gRes.data || []);
    }
  };

  // Question Handlers
  const handleOpenNewQuestion = (part: CanonicalToeicPart, groupId?: string) => {
    const range = TOEIC_FULL_TEST_STRUCTURE[part];
    const existingNums = (questions || []).map((q) => q?.question_number);
    let nextNum = range.startNumber;
    while (existingNums.includes(nextNum) && nextNum <= range.endNumber) {
      nextNum++;
    }
    if (nextNum > range.endNumber) nextNum = range.startNumber;

    const optCount = expectedOptionCountForPart(part);
    const opts = optCount === 3 ? ['(A) ', '(B) ', '(C) '] : ['(A) ', '(B) ', '(C) ', '(D) '];

    setEditingQuestionId('NEW');
    setQuestionForm({
      group_id: groupId || '',
      question_number: nextNum,
      part,
      question_text: '',
      options: opts,
      correct_answer: opts[0],
      explanation: '',
      skill_tag: '',
      topic: '',
      difficulty: 'medium',
      audio_url: '',
      image_url: '',
    });
  };

  const handleSaveQuestion = async () => {
    if (!testId) {
      alert('Vui lòng lưu thông tin đề thi trước khi thêm câu hỏi.');
      return;
    }
    setSaving(true);
    const res = await saveToeicTestQuestion(testId, {
      ...questionForm,
      id: editingQuestionId === 'NEW' ? undefined : editingQuestionId!,
    });

    if (res.error) {
      alert(res.error);
    } else {
      setEditingQuestionId(null);
      const qRes = await getToeicTestQuestions(testId);
      setQuestions(qRes.data || []);
    }
    setSaving(false);
  };

  const handleToggleQuestionActive = async (qId: string, currentActive: boolean) => {
    const res = await setToeicTestQuestionActive(qId, !currentActive);
    if (res.error) alert(res.error);
    else {
      const qRes = await getToeicTestQuestions(testId!);
      setQuestions(qRes.data || []);
    }
  };

  // Calculate completeness summary safely
  const safeQuestions = Array.isArray(questions) ? questions : [];
  const partSummary = getPartSummary(safeQuestions);
  const activeQuestionsCount = new Set(safeQuestions.filter((q) => q && q.is_active === true).map((q) => q.question_number)).size;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin/content/test-bank"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Ngân Hàng Đề
        </NavLink>
      </div>

      {loading ? (
        <LoadingState message="Đang tải thông tin đề thi TOEIC..." />
      ) : (
        <>
          {/* Header Form */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
              <h1 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-ori-600" />
                {isEditing ? `Chỉnh Sửa Đề Thi: ${title}` : 'Tạo Đề Thi TOEIC Mới'}
              </h1>

              <button
                type="button"
                onClick={handleSaveHeader}
                disabled={saving}
                className="px-5 py-2.5 bg-ori-600 hover:bg-ori-500 text-white font-extrabold text-xs rounded-xl shadow-md shadow-ori-600/20 flex items-center gap-1.5 transition-all"
              >
                <Save className="w-4 h-4" /> {saving ? 'Đang Lưu...' : 'Lưu Thông Tin Đầu Đề'}
              </button>
            </div>

            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveHeader} className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
              <div>
                <label className="text-slate-700 block mb-1">
                  Tên Đề Thi <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: TOEIC Full Test 01"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-ori-600"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">
                  Slug URL <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="toeic-full-test-01"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-ori-600"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Mã Đề Thi (Test Code)</label>
                <input
                  type="text"
                  placeholder="ETS2024-TEST01"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-ori-600"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Loại Đề Thi</label>
                <select
                  value={testType}
                  onChange={(e) => setTestType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-ori-600"
                >
                  <option value="full">Full Test (Chuẩn 200 câu)</option>
                  <option value="mini">Mini Test</option>
                  <option value="custom">Custom Test</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Thứ Tự Sắp Xếp</label>
                <input
                  type="number"
                  min="0"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-ori-600"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1">Mô Tả Đề Thi</label>
                <input
                  type="text"
                  placeholder="Mô tả hoặc nguồn đề thi..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-ori-600"
                />
              </div>
            </form>
          </div>

          {/* Completeness Dashboard */}
          {isEditing && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Bảng Tiến Độ Hoàn Thiện Đề Thi (Test Completeness Dashboard)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tổng số câu hỏi active: <strong className="text-slate-900">{activeQuestionsCount} / 200 câu</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowScriptBilingualModal(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all"
                  >
                    <span>📝 Script & Song ngữ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAnswerKeyModal(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all"
                  >
                    <span>📋 Import Answer Key</span>
                  </button>

                  <span
                    className={`px-3 py-1 text-xs font-extrabold rounded-full border ${
                      activeQuestionsCount === 200
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {activeQuestionsCount === 200 ? 'HOÀN THÀNH 200 CÂU' : `CHƯA HOÀN THÀNH (${activeQuestionsCount}/200)`}
                  </span>
                </div>
              </div>

              {/* Part Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-7 gap-2 text-center">
                {CANONICAL_TOEIC_PARTS.map((pKey) => {
                  const s = partSummary[pKey];
                  return (
                    <div
                      key={pKey}
                      onClick={() => setActivePart(pKey)}
                      className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                        activePart === pKey
                          ? 'bg-ori-50/80 border-ori-500 shadow-xs'
                          : s.isComplete
                          ? 'bg-emerald-50/50 border-emerald-200'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-[10px] font-extrabold uppercase text-slate-500 block">{pKey}</span>
                      <span
                        className={`text-sm font-extrabold block ${
                          s.isComplete ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {s.count} / {s.expected}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Part Editor Area */}
          {isEditing && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
              {/* Part Tabs & Actions Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1">
                  {CANONICAL_TOEIC_PARTS.map((pKey) => {
                    const s = partSummary[pKey];
                    const isSelected = activePart === pKey;
                    return (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => setActivePart(pKey)}
                        className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 ${
                          isSelected
                            ? 'bg-ori-600 text-white shadow-md shadow-ori-600/20'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <span>{TOEIC_FULL_TEST_STRUCTURE[pKey].nameVi}</span>
                        <span
                          className={`px-2 py-0.5 text-[10px] font-mono rounded-full ${
                            isSelected
                              ? 'bg-white/20 text-white'
                              : s.isComplete
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {s.count}/{s.expected}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setActivePart('media')}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 ${
                      activePart === 'media'
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Media Manager</span>
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowScriptBilingualModal(true)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
                  >
                    <span>📝 Script & Song ngữ</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAnswerKeyModal(true)}
                    className="px-4 py-2.5 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap flex items-center gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/20"
                  >
                    <span>📋 Import Answer Key</span>
                  </button>
                </div>
              </div>

              {/* Media Manager Tab */}
              {activePart === 'media' && (
                <MediaManagerTab
                  testId={testId!}
                  test={{
                    id: testId,
                    title,
                    slug,
                    is_published: isPublished,
                    listening_audio_mode: listeningAudioMode,
                    listening_audio_url: listeningAudioUrl
                  }}
                  groups={groups}
                  questions={questions}
                  onMediaUpdated={loadTestDetails}
                />
              )}

              {/* Part Section */}
              {activePart !== 'media' && (
                <div className="space-y-6">
                  {/* Part Section Header */}
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-ori-600" />
                    Quản Lý {TOEIC_FULL_TEST_STRUCTURE[activePart].nameVi}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dải câu hỏi quy định: <strong>Câu #{TOEIC_FULL_TEST_STRUCTURE[activePart].startNumber} đến #{TOEIC_FULL_TEST_STRUCTURE[activePart].endNumber}</strong> ({TOEIC_FULL_TEST_STRUCTURE[activePart].expectedCount} câu)
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {activePart !== 'part5' && (
                    <button
                      type="button"
                      onClick={() => handleOpenNewGroup(activePart)}
                      className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm Nhóm Bài (Group)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenNewQuestion(activePart)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm Câu Hỏi Mới
                  </button>
                </div>
              </div>

              {/* Group list for active part */}
              {groups.filter((g) => g.part === activePart).length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Danh Sách Nhóm (Groups) trong {activePart.toUpperCase()}</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {groups
                      .filter((g) => g.part === activePart)
                      .map((g) => (
                        <div key={g.id} className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <span className="font-extrabold text-purple-900 block">{g.title || `Nhóm ${g.group_type}`}</span>
                            <span className="text-[10px] text-purple-600 font-mono">ID: {g.id.slice(0, 8)} | Type: {g.group_type}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleGroupActive(g.id, g.is_active !== false)}
                              className="px-2.5 py-1 bg-white border border-purple-200 text-purple-700 text-[10px] font-bold rounded-lg"
                            >
                              {g.is_active === false ? 'Hiện Nhóm' : 'Ẩn Nhóm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingGroupId(g.id);
                                setGroupForm({ ...g });
                              }}
                              className="px-2.5 py-1 bg-purple-600 text-white text-[10px] font-bold rounded-lg"
                            >
                              Sửa Nhóm
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Inline Group Editor Form Modal */}
              {editingGroupId && (
                <div className="p-5 bg-purple-50 border border-purple-200 rounded-2xl space-y-4 text-xs font-bold">
                  <h4 className="text-sm font-extrabold text-purple-900 border-b border-purple-200 pb-2">
                    {editingGroupId === 'NEW' ? 'Tạo Nhóm Câu Hỏi Mới' : 'Chỉnh Sửa Nhóm Câu Hỏi'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 block mb-1">Loại Nhóm (group_type)</label>
                      <input
                        type="text"
                        value={groupForm.group_type}
                        onChange={(e) => setGroupForm({ ...groupForm, group_type: e.target.value })}
                        className="w-full px-3 py-2 bg-white border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 block mb-1">Tiêu Đề Nhóm</label>
                      <input
                        type="text"
                        value={groupForm.title || ''}
                        onChange={(e) => setGroupForm({ ...groupForm, title: e.target.value })}
                        className="w-full px-3 py-2 bg-white border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 block mb-1">Audio URL</label>
                      <input
                        type="text"
                        value={groupForm.audio_url || ''}
                        onChange={(e) => setGroupForm({ ...groupForm, audio_url: e.target.value })}
                        className="w-full px-3 py-2 bg-white border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 block mb-1">Image URL</label>
                      <input
                        type="text"
                        value={groupForm.image_url || ''}
                        onChange={(e) => setGroupForm({ ...groupForm, image_url: e.target.value })}
                        className="w-full px-3 py-2 bg-white border rounded-xl"
                      />
                    </div>
                  </div>

                  {groupForm.documents && groupForm.documents.length > 0 ? (
                    <div className="space-y-3">
                      <label className="text-slate-700 block mb-1 font-extrabold text-sm border-t pt-4">Tài liệu (Documents)</label>
                      {groupForm.documents.map((doc: any, i: number) => (
                        <div key={i} className="p-4 bg-white border border-slate-200 shadow-sm rounded-xl space-y-3">
                          <h5 className="text-xs font-extrabold text-slate-500 uppercase border-b pb-1 mb-2">Tài liệu {i + 1}</h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">Loại (Type)</label>
                              <input
                                type="text"
                                value={doc.type || ''}
                                onChange={(e) => {
                                  const newDocs = [...groupForm.documents!];
                                  newDocs[i] = { ...newDocs[i], type: e.target.value };
                                  setGroupForm({ ...groupForm, documents: newDocs });
                                }}
                                className="w-full px-3 py-1.5 bg-slate-50 border rounded-lg text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 block mb-1">Tiêu đề (Title)</label>
                              <input
                                type="text"
                                value={doc.title || ''}
                                onChange={(e) => {
                                  const newDocs = [...groupForm.documents!];
                                  newDocs[i] = { ...newDocs[i], title: e.target.value };
                                  setGroupForm({ ...groupForm, documents: newDocs });
                                }}
                                className="w-full px-3 py-1.5 bg-slate-50 border rounded-lg text-xs"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Nội dung (Content)</label>
                            <textarea
                              rows={4}
                              value={doc.content || ''}
                              onChange={(e) => {
                                const newDocs = [...groupForm.documents!];
                                newDocs[i] = { ...newDocs[i], content: e.target.value };
                                setGroupForm({ ...groupForm, documents: newDocs });
                              }}
                              className="w-full p-3 bg-slate-50 border rounded-lg text-xs font-mono"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <label className="text-slate-700 block mb-1">Đoạn Văn (Passage) / Hướng Dẫn</label>
                      <textarea
                        rows={4}
                        value={groupForm.passage || ''}
                        onChange={(e) => setGroupForm({ ...groupForm, passage: e.target.value })}
                        className="w-full p-3 bg-white border rounded-xl font-mono text-xs"
                      />
                      <label className="text-slate-700 block mb-1 mt-2">Bản Dịch Đoạn Văn (Passage Translation VI)</label>
                      <textarea
                        rows={3}
                        value={groupForm.passage_vi || ''}
                        onChange={(e) => setGroupForm({ ...groupForm, passage_vi: e.target.value })}
                        placeholder="Nhập bản dịch tiếng Việt cho đoạn văn..."
                        className="w-full p-3 bg-white border rounded-xl text-xs font-medium text-slate-600"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveGroup}
                      disabled={saving}
                      className="px-4 py-2 bg-purple-600 text-white font-extrabold rounded-xl"
                    >
                      {saving ? 'Đang lưu...' : 'Lưu Nhóm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingGroupId(null)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 font-extrabold rounded-xl"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Inline Question Editor Form Modal */}
              {editingQuestionId && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-4 text-xs font-bold">
                  <h4 className="text-sm font-extrabold text-emerald-900 border-b border-emerald-200 pb-2">
                    {editingQuestionId === 'NEW' ? 'Tạo Câu Hỏi Mới' : 'Chỉnh Sửa Câu Hỏi'}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-slate-700 block mb-1">Số Thứ Tự Câu Hỏi (#)</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={questionForm.question_number}
                        onChange={(e) =>
                          setQuestionForm({
                            ...questionForm,
                            question_number: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        className="w-full px-3 py-2 bg-white border rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="text-slate-700 block mb-1">Thuộc Nhóm (Group)</label>
                      <select
                        value={questionForm.group_id || ''}
                        onChange={(e) => setQuestionForm({ ...questionForm, group_id: e.target.value })}
                        className="w-full px-3 py-2 bg-white border rounded-xl"
                      >
                        <option value="">-- Không thuộc nhóm (Standalone) --</option>
                        {groups
                          .filter((g) => g.part === activePart)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title || `Nhóm ${g.group_type} (${g.id.slice(0, 8)})`}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-slate-700 block mb-1">Đáp Án Đúng</label>
                      <select
                        value={questionForm.correct_answer}
                        onChange={(e) => setQuestionForm({ ...questionForm, correct_answer: e.target.value })}
                        className="w-full px-3 py-2 bg-white border rounded-xl"
                      >
                        {questionForm.options.map((opt: string, idx: number) => {
                          const letter = String.fromCharCode(65 + idx);
                          return (
                            <option key={idx} value={letter}>
                              {letter} - {opt || `Lựa chọn #${idx + 1}`}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">Nội Dung Câu Hỏi (Question Text)</label>
                    <textarea
                      rows={2}
                      value={questionForm.question_text || ''}
                      onChange={(e) => setQuestionForm({ ...questionForm, question_text: e.target.value })}
                      className="w-full p-3 bg-white border rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">Bản Dịch Câu Hỏi (Question Translation VI)</label>
                    <textarea
                      rows={2}
                      value={questionForm.translation_vi || ''}
                      onChange={(e) => setQuestionForm({ ...questionForm, translation_vi: e.target.value })}
                      placeholder="Nhập bản dịch tiếng Việt cho câu hỏi..."
                      className="w-full p-3 bg-white border rounded-xl text-xs font-medium text-slate-600"
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-2">
                    <label className="text-slate-700 block">Các Lựa Chọn Đáp Án</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {questionForm.options.map((opt: string, idx: number) => (
                        <input
                          key={idx}
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...questionForm.options];
                            newOpts[idx] = e.target.value;
                            setQuestionForm({ ...questionForm, options: newOpts });
                          }}
                          className="px-3 py-2 bg-white border rounded-xl"
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1">Giải Thích (Explanation)</label>
                    <textarea
                      rows={2}
                      value={questionForm.explanation || ''}
                      onChange={(e) => setQuestionForm({ ...questionForm, explanation: e.target.value })}
                      className="w-full p-3 bg-white border rounded-xl text-xs font-medium"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={handleSaveQuestion}
                      disabled={saving}
                      className="px-4 py-2 bg-emerald-600 text-white font-extrabold rounded-xl"
                    >
                      {saving ? 'Đang lưu...' : 'Lưu Câu Hỏi'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingQuestionId(null)}
                      className="px-4 py-2 bg-slate-200 text-slate-700 font-extrabold rounded-xl"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}

              {/* Questions List for Active Part */}
              <div className="space-y-4">
                {questions
                  .filter((q) => q.part === activePart)
                  .sort((a, b) => a.question_number - b.question_number)
                  .map((q) => (
                    <div
                      key={q.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        q.is_active === false
                          ? 'bg-slate-100/60 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-ori-600">Câu #{q.question_number}</span>
                          {q.is_active === false && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-extrabold uppercase rounded-full">
                              ĐÃ ẨN
                            </span>
                          )}
                        </div>

                        {/* Actions: NO HARD DELETE BUTTON */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleQuestionActive(q.id, q.is_active !== false)}
                            className={`px-3 py-1 text-[11px] font-extrabold rounded-xl border transition-colors ${
                              q.is_active === false
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {q.is_active === false ? 'Hiện Lại' : 'Ẩn Câu'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingQuestionId(q.id);
                              setQuestionForm({ ...q, options: Array.isArray(q.options) ? q.options : [] });
                            }}
                            className="px-3 py-1 bg-ori-50 text-ori-700 font-extrabold text-xs rounded-xl border border-ori-200"
                          >
                            Sửa
                          </button>
                        </div>
                      </div>

                      {q.question_text && <p className="text-xs font-bold text-slate-900 mt-2">{q.question_text}</p>}
                      
                      {(!Array.isArray(q.options) || q.options.length === 0 || q.options.some((o: any) => !hasOptionText(o))) && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs font-bold">
                          ⚠️ Cảnh báo: Câu hỏi này thiếu đáp án hoặc có đáp án rỗng!
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                        {Array.isArray(q.options) &&
                          q.options.map((optItem: any, idx: number) => {
                            const optText = safeOptionText(optItem);
                            const optLabel = typeof optItem === 'object' && optItem?.label ? optItem.label : String.fromCharCode(65 + idx);
                            const isCorrect = q.correct_answer === optLabel || (typeof q.correct_answer === 'string' && q.correct_answer.charCodeAt(0) - 65 === idx);

                            return (
                              <div
                                key={idx}
                                className={`p-2 rounded-xl border text-[11px] font-medium ${
                                  isCorrect
                                    ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-900'
                                    : 'bg-slate-50 border-slate-200 text-slate-700'
                                }`}
                              >
                                {optText}
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            )}
          </div>
          )}
        </>
      )}

      {isEditing && testId && (
        <>
          <SafeAnswerKeyImporterModal
            isOpen={showAnswerKeyModal}
            onClose={() => setShowAnswerKeyModal(false)}
            testId={testId}
            testTitle={title}
            isPublished={isPublished}
            existingQuestions={questions ?? []}
            onUpdated={loadTestDetails}
          />

          <SafeScriptBilingualManagerModal
            isOpen={showScriptBilingualModal}
            onClose={() => setShowScriptBilingualModal(false)}
            testId={testId}
            testTitle={title}
            isPublished={isPublished}
            existingQuestions={questions ?? []}
            existingGroups={groups ?? []}
            onUpdated={loadTestDetails}
          />
        </>
      )}
    </div>
  );
};

export const AdminToeicTestEditPage: React.FC = () => {
  return (
    <AdminTestEditErrorBoundary>
      <AdminToeicTestEditPageInner />
    </AdminTestEditErrorBoundary>
  );
};
