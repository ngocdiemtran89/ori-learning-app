import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShieldCheck, Users, Layers, ArrowRight } from 'lucide-react';

export const AdminPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
        <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-ori-600" />
          Bảng Quản Trị Hệ Thống (Admin Panel)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Quản lý tài khoản học viên, gia hạn ngày học, quản lý nội dung và các module học tập.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NavLink
          to="/admin/students"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-ori-500 shadow-sm hover:shadow-md transition-all group flex items-start justify-between"
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-sky-50 text-ori-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base group-hover:text-ori-600 transition-colors">
              Quản Lý Học Viên (Students)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Xem danh sách học viên, theo dõi tiến độ học tập, chỉnh level và gia hạn ngày hết hạn.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-ori-600 group-hover:translate-x-1 transition-all" />
        </NavLink>

        <NavLink
          to="/admin/content"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-500 shadow-sm hover:shadow-md transition-all group flex items-start justify-between"
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-extrabold text-slate-900 text-base group-hover:text-indigo-600 transition-colors">
              Quản Lý Nội Dung (CMS)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Tạo, chỉnh sửa và xuất bản nội dung học tập ORI (Từ vựng, Ngữ pháp, Listening, Reading).
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
        </NavLink>

        <NavLink
          to="/admin/tools/toeic-audio-cutter"
          className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-emerald-500 shadow-sm hover:shadow-md transition-all group flex items-start justify-between sm:col-span-2"
        >
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="text-lg">🎧</span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-base group-hover:text-emerald-600 transition-colors">
              🎧 TOEIC Audio Cutter (Cắt Mốc Audio Listening)
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Công cụ cắt mốc thời gian bài nghe TOEIC 100 câu (1 MP3 duy nhất + Mốc phân đoạn). Tự động tạo khung Part 1-4, tinh chỉnh miligiây, Import/Export JSON.
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
        </NavLink>
      </div>
    </div>
  );
};
