import React from 'react';
import { NavLink } from 'react-router-dom';
import { Lock, ArrowLeft, PhoneCall } from 'lucide-react';

export const ExpiredPage: React.FC = () => {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-amber-200 shadow-xl text-center space-y-6">
        <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase">
            Access Expired / Quá hạn truy cập
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">Tài Khoản Đã Hết Hạn Học Tập</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Thời hạn truy cập khóa học theo tháng của bạn đã kết thúc. Nội dung trả phí đã được khóa bảo vệ an toàn theo chính sách Supabase RLS.
          </p>
        </div>

        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-2">
          <div className="font-bold text-slate-700 flex items-center gap-1.5">
            <PhoneCall className="w-4 h-4 text-ori-600" /> Gia hạn học tập tại Trung tâm ORI:
          </div>
          <p className="text-slate-600">Hotline: 0906.xxx.xxx | Email: giaovu@oritoeic.edu.vn</p>
        </div>

        <NavLink
          to="/login"
          className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl inline-flex items-center justify-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại trang Đăng nhập
        </NavLink>
      </div>
    </div>
  );
};
