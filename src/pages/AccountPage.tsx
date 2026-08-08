import React from 'react';
import { User, ShieldCheck, Mail, Clock, LogOut, AlertTriangle, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SupabaseDiagnostics } from '../components/debug/SupabaseDiagnostics';

export const AccountPage: React.FC = () => {
  const { user, profile, isActive, isExpired, isDisabled, signOut } = useAuth();

  const fullName = profile?.full_name || user?.email?.split('@')[0] || 'Học viên ORI';
  const level = profile?.level || 'foundation';
  const role = profile?.role || 'student';
  const expiresAtFormatted = profile?.access_expires_at
    ? new Date(profile.access_expires_at).toLocaleDateString('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Chưa có thông tin';

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <User className="w-6 h-6 text-ori-600" />
            Thông Tin Tài Khoản Học Viên
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Quản lý thông tin cá nhân và kiểm tra thời hạn truy cập cổng học tập ORI Learning.
          </p>
        </div>

        <button
          onClick={signOut}
          className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
        >
          <LogOut className="w-4 h-4 text-slate-500" />
          <span>Đăng xuất</span>
        </button>
      </div>

      <SupabaseDiagnostics />

      {/* Account Profile Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-ori-600 to-sky-400 text-white flex items-center justify-center font-extrabold text-xl shadow-lg shadow-ori-600/20">
            {fullName.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-900">{fullName}</h2>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold uppercase">
                {role}
              </span>
            </div>
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> {user?.email || 'N/A'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-slate-400 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-ori-600" /> Trạng thái tài khoản
            </div>
            <div className="font-extrabold text-sm">
              {isActive ? (
                <span className="text-emerald-600 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> Active (Hoạt động)
                </span>
              ) : isExpired ? (
                <span className="text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" /> Expired (Hết hạn)
                </span>
              ) : isDisabled ? (
                <span className="text-rose-600 flex items-center gap-1">
                  <ShieldAlert className="w-4 h-4" /> Disabled (Bị khóa)
                </span>
              ) : (
                <span className="text-slate-600">Unverified</span>
              )}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-slate-400 font-bold flex items-center gap-1.5">
              <User className="w-4 h-4 text-indigo-600" /> Trình độ (Level)
            </div>
            <div className="text-sm font-extrabold text-slate-900 capitalize">{level}</div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
            <div className="text-slate-400 font-bold flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500" /> Ngày hết hạn truy cập
            </div>
            <div className="text-xs font-extrabold text-slate-800">{expiresAtFormatted}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
