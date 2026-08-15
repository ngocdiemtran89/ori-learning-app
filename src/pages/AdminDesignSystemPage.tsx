import React, { useState } from 'react';
import {
  PageHeader,
  SectionHeader,
  Card,
  CardHeader,
  Button,
  Badge,
  StatCard,
  Tabs,
  Input,
  Select,
  Textarea,
  Alert,
  AdminTable,
  Column,
} from '../components/ui';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface SampleItem {
  id: string;
  qNum: number;
  part: string;
  questionEn: string;
  questionVi: string;
  status: 'READY' | 'REVIEW' | 'ERROR';
  page: number;
}

export const AdminDesignSystemPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');

  const sampleData: SampleItem[] = [
    {
      id: '1',
      qNum: 1,
      part: 'P1',
      questionEn: 'There are several people walking along the street.',
      questionVi: 'Có nhiều người đang đi bộ dọc theo con phố.',
      status: 'READY',
      page: 1,
    },
    {
      id: '2',
      qNum: 7,
      part: 'P2',
      questionEn: 'When is the upcoming quarterly sales meeting?',
      questionVi: 'Khi nào thì cuộc họp doanh số quý tới diễn ra?',
      status: 'READY',
      page: 3,
    },
    {
      id: '3',
      qNum: 63,
      part: 'P3',
      questionEn: 'Look at the graphic. Which tool does the man recommend?',
      questionVi: 'Nhìn vào hình ảnh. Người đàn ông đề xuất công cụ nào?',
      status: 'REVIEW',
      page: 7,
    },
    {
      id: '4',
      qNum: 101,
      part: 'P5',
      questionEn: 'Mr. Tanaka will ------ the new marketing strategy tomorrow.',
      questionVi: 'Ông Tanaka sẽ trình bày chiến lược tiếp thị mới vào ngày mai.',
      status: 'READY',
      page: 12,
    },
  ];

  const columns: Column<SampleItem>[] = [
    {
      key: 'qNum',
      header: 'CÂU',
      width: '64px',
      align: 'center',
      render: (item) => (
        <span className="font-extrabold text-ori-700 bg-ori-50 px-2 py-0.5 rounded-md tabular-nums text-xs border border-ori-100">
          Q{item.qNum}
        </span>
      ),
    },
    {
      key: 'part',
      header: 'PART',
      width: '64px',
      align: 'center',
      render: (item) => (
        <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs tabular-nums">
          {item.part}
        </span>
      ),
    },
    {
      key: 'content',
      header: 'NỘI DUNG CÂU HỎI (TIẾNG ANH & TIẾNG VIỆT)',
      render: (item) => (
        <div className="space-y-1 py-1">
          <div className="type-body-strong text-slate-900 line-clamp-1">{item.questionEn}</div>
          <div className="type-body text-slate-500 text-xs italic line-clamp-1">🇻🇳 {item.questionVi}</div>
        </div>
      ),
    },
    {
      key: 'page',
      header: 'TRANG PDF',
      width: '90px',
      align: 'center',
      render: (item) => (
        <span className="type-helper text-slate-500 tabular-nums">Trang {item.page}</span>
      ),
    },
    {
      key: 'status',
      header: 'TRẠNG THÁI',
      width: '110px',
      align: 'center',
      render: (item) => (
        <Badge
          variant={item.status === 'READY' ? 'success' : item.status === 'REVIEW' ? 'warning' : 'danger'}
        >
          {item.status}
        </Badge>
      ),
    },
  ];

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-10">
      {/* Page Header */}
      <PageHeader
        title="ORI Learning Design System V1"
        description="Nguồn sự thật trực quan (Visual Source of Truth) dành riêng cho Giao diện Quản trị và Học tập ORI."
        badge={
          <Badge variant="purple" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
            ADMIN INTERNAL ONLY
          </Badge>
        }
        actions={
          <Button variant="primary" leftIcon={<Sparkles className="w-4 h-4" />}>
            Tài liệu Design System
          </Button>
        }
      />

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'overview', label: '1. Tổng quan & Typography' },
          { id: 'components', label: '2. UI Primitives & Control' },
          { id: 'table', label: '3. Data Table & Density' },
          { id: 'forms', label: '4. Form & Formats' },
        ]}
        activeTab={activeTab}
        onChange={(tab) => setActiveTab(tab as string)}
      />

      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Typography Scale Section */}
          <Card>
            <CardHeader>
              <SectionHeader
                title="Typography Scale & Roles"
                subtitle="Sử dụng duy nhất font Plus Jakarta Sans chuẩn tiếng Việt diacritic"
              />
            </CardHeader>

            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="type-label text-slate-400 uppercase">PAGE TITLE (28px / 36px / 700 / -0.02em)</span>
                <div className="type-page-title">
                  Quản lý Ngân hàng Đề thi TOEIC 2026 Chuẩn Hóa ORI
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="type-label text-slate-400 uppercase">SECTION HEADING (20px / 28px / 700 / -0.01em)</span>
                <div className="type-section-heading">
                  Báo cáo Tiến độ Hoàn thiện & Trích xuất Dữ liệu
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="type-label text-slate-400 uppercase">COMPONENT HEADING (16px / 24px / 600)</span>
                <div className="type-component-heading">
                  Part 3: Đoạn Hội thoại & Nhóm 3 Câu hỏi Kèm Hình ảnh
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="type-label text-slate-400 uppercase">BODY & BODY STRONG (14px / 22px / 400 & 600)</span>
                <p className="type-body max-w-2xl">
                  Hệ thống hỗ trợ trích xuất tự động các đơn vị bài học (Vocab, Grammar, Collocation, Paraphrase) từ câu hỏi Part 5 và Part 2. <span className="type-body-strong">Dữ liệu được chuẩn hóa và không tạo trùng lặp trong Ngân hàng Đề thi Canonical.</span>
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                <span className="type-label text-slate-400 uppercase">TABULAR NUMERALS DEMO (font-variant-numeric: tabular-nums)</span>
                <div className="flex flex-wrap gap-6 text-sm font-bold tabular-nums text-slate-800">
                  <span>Cấu trúc: 200/200</span>
                  <span>Audio: 54/54</span>
                  <span>Part 1: 06/06</span>
                  <span>Part 2: 25/25</span>
                  <span>Thời gian: 01:45:30</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Stat Cards Grid */}
          <SectionHeader title="Stat Cards Baseline Alignment" subtitle="Các ô thống kê sử dụng con số tabular và đường cơ sở căn chỉnh chuẩn" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="CẤU TRÚC" value={200} target={200} status="complete" statusLabel="SẴN SÀNG" />
            <StatCard label="FILE AUDIO" value={54} target={54} status="complete" statusLabel="SẴN SÀNG" />
            <StatCard label="P1 IMAGES" value={6} target={6} status="complete" statusLabel="SẴN SÀNG" />
            <StatCard label="P2 TRANSCRIPT" value={0} target={25} status="warning" statusLabel="CẦN XEM XÉT" />
          </div>
        </div>
      )}

      {activeTab === 'components' && (
        <div className="space-y-8">
          {/* Buttons */}
          <Card>
            <CardHeader>
              <SectionHeader title="Button Primitive System" subtitle="Hệ thống nút bấm chuẩn chiều cao 36px/40px/44px với gap 8px và font 600" />
            </CardHeader>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                  Tạo Đề Thi Mới
                </Button>
                <Button variant="secondary" leftIcon={<FileText className="w-4 h-4" />}>
                  Xuất JSON v1
                </Button>
                <Button variant="success" leftIcon={<CheckCircle2 className="w-4 h-4" />}>
                  Duyệt Bản Nháp
                </Button>
                <Button variant="danger">Xóa Bản Nháp</Button>
                <Button variant="outline">Xem Trước</Button>
                <Button variant="ghost">Bỏ qua</Button>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button variant="primary" size="sm">Small 36px</Button>
                <Button variant="primary" size="md">Medium 40px</Button>
                <Button variant="primary" size="lg">Large 44px</Button>
                <Button variant="primary" isLoading>Đang xử lý</Button>
              </div>
            </div>
          </Card>

          {/* Badges */}
          <Card>
            <CardHeader>
              <SectionHeader title="Badge Budget & System" subtitle="Thẻ trạng thái đồng bộ chiều cao, typography và padding" />
            </CardHeader>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="neutral">NEUTRAL</Badge>
              <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>COMPLETED</Badge>
              <Badge variant="warning" icon={<AlertTriangle className="w-3 h-3" />}>NEEDS REVIEW</Badge>
              <Badge variant="danger">BLOCKED</Badge>
              <Badge variant="info">IN PROGRESS</Badge>
              <Badge variant="purple">V2 DERIVED</Badge>
            </div>
          </Card>

          {/* Alerts */}
          <div className="space-y-4">
            <Alert variant="info" title="Thông báo hệ thống ORI V2">
              Toàn bộ bài học trích xuất từ đề thi sẽ tự động đồng bộ vào Kho Học Tập V2 mà không ghi đè dữ liệu Canonical.
            </Alert>
            <Alert variant="warning" title="Cảnh báo kiểm duyệt">
              Văn bản bài nghe Part 2 chưa có transcript đầy đủ (0/25 câu). Vui lòng nạp gói ChatGPT Hybrid JSON trước khi Xuất bản.
            </Alert>
          </div>
        </div>
      )}

      {activeTab === 'table' && (
        <div className="space-y-6">
          <SectionHeader
            title="Staging Table & Scannability"
            subtitle="Bảng dữ liệu admin chuẩn hóa độ rộng cột, căn dọc giữa và typography tiếng Anh / tiếng Việt phân cấp"
            actions={
              <Badge variant="neutral" icon={<Zap className="w-3 h-3" />}>
                DENSE MODE
              </Badge>
            }
          />
          <AdminTable columns={columns} data={sampleData} keyExtractor={(item) => item.id} />
        </div>
      )}

      {activeTab === 'forms' && (
        <Card className="max-w-2xl">
          <CardHeader>
            <SectionHeader title="Standard Form Controls" subtitle="Form inputs chuẩn height 40px, focus ring và helper text" />
          </CardHeader>

          <div className="space-y-5">
            <Input
              label="Tiêu đề đề thi TOEIC"
              placeholder="Ví dụ: ORI 2026 - Test 1"
              defaultValue="ORI 2026 - Test 1"
              leftIcon={<Search className="w-4 h-4" />}
              helperText="Tên đề thi hiển thị cho học viên trên Cổng Luyện Thi."
            />

            <Select
              label="Loại Đề Thi"
              options={[
                { value: 'full', label: 'Full TOEIC Test (200 Câu)' },
                { value: 'mini', label: 'Mini TOEIC Test (100 Câu)' },
              ]}
            />

            <Textarea
              label="Ghi chú tác giả / Hướng dẫn bài test"
              placeholder="Nhập hướng dẫn làm bài..."
              defaultValue="Học viên hoàn thành 200 câu hỏi trong 120 phút. Đáp án và bản dịch chi tiết sẽ mở sau khi nộp bài."
            />

            <div className="pt-2 flex justify-end gap-2">
              <Button variant="outline">Hủy</Button>

              <Button variant="primary" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Lưu Cấu Hình
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
