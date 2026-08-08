import React from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft, BookOpen, Headphones, FileText, Layers, ShieldCheck } from 'lucide-react';

export const AdminContentPage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Bảng Admin
        </NavLink>
        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Quản Lý Nội Dung ORI CMS
        </span>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-2">
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Layers className="w-6 h-6 text-ori-600" /> Bảng Quản Lý Nội Dung Học Tập (Content CMS)
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Tạo, chỉnh sửa, xem trước và xuất bản các module học tập của ORI Learning.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Active Module: Vocabulary */}
        <NavLink
          to="/admin/content/vocabulary"
          className="bg-white p-6 rounded-3xl border border-indigo-100 hover:border-indigo-500 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-extrabold">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full">
                ACTIVE CMS
              </span>
            </div>

            <div>
              <h2 className="font-extrabold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                Quản Lý Từ Vựng (Vocabulary CMS)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Tạo bộ từ vựng (Decks), thêm từ mới, cấu hình IPA, collocations, ví dụ và xuất bản/ẩn bài.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 pt-2">
            Quản Lý Bộ Từ ➔
          </span>
        </NavLink>

        {/* Active Module: Grammar */}
        <NavLink
          to="/admin/content/grammar"
          className="bg-white p-6 rounded-3xl border border-indigo-100 hover:border-indigo-500 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-extrabold">
                <FileText className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full">
                ACTIVE CMS
              </span>
            </div>

            <div>
              <h2 className="font-extrabold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">
                Quản Lý Ngữ Pháp (Grammar CMS)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Soạn bài giảng chuyên đề ngữ pháp, phần lý thuyết, câu hỏi quiz trắc nghiệm và lời giải thích.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-indigo-600 pt-2">
            Quản Lý Ngữ Pháp ➔
          </span>
        </NavLink>

        {/* Active Module: Listening */}
        <NavLink
          to="/admin/content/listening"
          className="bg-white p-6 rounded-3xl border border-purple-100 hover:border-purple-500 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-extrabold">
                <Headphones className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full">
                ACTIVE CMS
              </span>
            </div>

            <div>
              <h2 className="font-extrabold text-slate-900 text-lg group-hover:text-purple-600 transition-colors">
                Quản Lý Luyện Nghe (Listening CMS)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Quản lý file âm thanh, bài tập TOEIC Part 1 - Part 4, hình ảnh minh họa và transcript.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-purple-600 pt-2">
            Quản Lý Listening ➔
          </span>
        </NavLink>

        {/* Active Module: Reading */}
        <NavLink
          to="/admin/content/reading"
          className="bg-white p-6 rounded-3xl border border-blue-100 hover:border-blue-500 shadow-sm hover:shadow-md transition-all group flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-extrabold">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold uppercase rounded-full">
                ACTIVE CMS
              </span>
            </div>

            <div>
              <h2 className="font-extrabold text-slate-900 text-lg group-hover:text-blue-600 transition-colors">
                Quản Lý Luyện Đọc (Reading CMS)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Tạo đoạn văn TOEIC Part 5, Part 6, Part 7 và các câu hỏi đọc hiểu.
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-600 pt-2">
            Quản Lý Reading ➔
          </span>
        </NavLink>
      </div>
    </div>
  );
};
