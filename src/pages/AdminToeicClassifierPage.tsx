import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle, Bot } from 'lucide-react';
import { PageHeader, Card, CardHeader, SectionHeader, Button, Badge } from '../components/ui';
import { ToeicClassifierSourceStep } from '../components/admin/classifier/ToeicClassifierSourceStep';
import { ToeicClassifierSummary } from '../components/admin/classifier/ToeicClassifierSummary';
import { ToeicClassifierPartReview } from '../components/admin/classifier/ToeicClassifierPartReview';
import { ToeicClassifierIssuePanel } from '../components/admin/classifier/ToeicClassifierIssuePanel';
import { parseRawToeicTest } from '../lib/toeic/classifier/classifyToeicTest';
import { validateParsedDraftForImport } from '../lib/toeic/classifier/classifierValidation';
import { importToeicTestDraft } from '../lib/supabase/adminToeicClassifier';
import { ParsedToeicTestDraft } from '../lib/toeic/classifier/types';

export const AdminToeicClassifierPage: React.FC = () => {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<ParsedToeicTestDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Metadata state for the test
  const [metadata, setMetadata] = useState({
    title: 'ORI 2026 - Test 1 (Phân loại tự động)',
    slug: 'de-thi-tu-dong-' + Date.now(),
    test_code: '',
    description: '',
    test_type: 'full' as 'full' | 'mini'
  });

  const handleSourceExtracted = (text: string, answerText: string) => {
    const parsed = parseRawToeicTest(text, metadata, answerText);
    setDraft(parsed);
  };

  const handleImport = async () => {
    if (!draft) return;
    
    // Sync metadata
    const finalDraft = { ...draft, metadata };

    const validation = validateParsedDraftForImport(finalDraft);
    if (!validation.isValid) {
      setImportError(validation.errors.join('\n'));
      return;
    }

    setLoading(true);
    setImportError(null);
    const result = await importToeicTestDraft(finalDraft);
    setLoading(false);

    if (result.success) {
      navigate('/admin/content/test-bank');
    } else {
      setImportError(result.error || 'Lỗi không xác định.');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PageHeader
        title="Phân Loại Đề TOEIC Tự Động"
        description="Tự động phân tích cấu trúc đề thi (Part 1–7), nhóm câu hỏi và ghép đáp án. Kết quả được lưu dưới dạng BẢN NHÁP DRAFT."
        breadcrumbs={[
          { label: 'Ngân hàng Đề thi', href: '/admin/content/test-bank' },
          { label: 'Phân loại tự động' },
        ]}
        badge={<Badge variant="purple" icon={<Bot className="w-3.5 h-3.5" />}>AUTO CLASSIFIER</Badge>}
        actions={
          <NavLink to="/admin/content/test-bank">
            <Button variant="outline" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Quay lại
            </Button>
          </NavLink>
        }
      />

      {!draft ? (
        <ToeicClassifierSourceStep onSourceExtracted={handleSourceExtracted} />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <SectionHeader title="Thông tin chung (Metadata)" subtitle="Tên đề thi hiển thị và mã định danh URL" />
            </CardHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Tên đề thi *</label>
                <input 
                  type="text" 
                  value={metadata.title}
                  onChange={(e) => setMetadata({...metadata, title: e.target.value})}
                  className="w-full p-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:border-ori-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Slug (URL) *</label>
                <input 
                  type="text" 
                  value={metadata.slug}
                  onChange={(e) => setMetadata({...metadata, slug: e.target.value})}
                  className="w-full p-2.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:border-ori-500 focus:outline-none"
                />
              </div>
            </div>
          </Card>

          <ToeicClassifierSummary draft={draft} />
          
          <ToeicClassifierIssuePanel issues={draft.issues} />

          <ToeicClassifierPartReview draft={draft} onUpdateDraft={setDraft} />

          {importError && (
             <div className="p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-2xl border border-rose-200 whitespace-pre-wrap">
               <div className="flex items-center gap-2 mb-2">
                 <AlertCircle className="w-5 h-5" />
                 <span className="text-sm">Không thể nhập dữ liệu:</span>
               </div>
               {importError}
             </div>
          )}

          <div className="flex justify-end gap-3 pt-6">
            <button
              onClick={() => setDraft(null)}
              className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-sm rounded-xl transition-all"
            >
              Hủy / Làm lại
            </button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="px-6 py-2.5 bg-ori-600 hover:bg-ori-500 disabled:opacity-50 text-white font-extrabold text-sm rounded-xl shadow-md transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Đang lưu...' : 'Nhập Vào Test Bank (Bản Nháp)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
