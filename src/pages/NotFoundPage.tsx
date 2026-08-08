import React from 'react';
import { NavLink } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto">
          <FileQuestion className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold text-slate-900">404</h1>
          <h2 className="text-lg font-bold text-slate-700">Trang không tồn tại</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Đường dẫn bạn yêu cầu không có trong hệ thống ORI Learning.
          </p>
        </div>

        <NavLink
          to="/dashboard"
          className="w-full py-3 px-4 bg-ori-600 hover:bg-ori-700 text-white font-bold text-xs rounded-xl inline-flex items-center justify-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Dashboard
        </NavLink>
      </div>
    </div>
  );
};
