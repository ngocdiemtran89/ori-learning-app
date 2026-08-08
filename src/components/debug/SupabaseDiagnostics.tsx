import React from 'react';
import { Database, CheckCircle2, ShieldCheck, UserCheck, AlertTriangle } from 'lucide-react';
import { useAuthSession } from '../../hooks/useAuthSession';

export const SupabaseDiagnostics: React.FC = () => {
  const { user, loading, error } = useAuthSession();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'Chưa cấu hình';

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-ori-600" />
          Chẩn Đoán Kết Nối Supabase Client (Development Diagnostic)
        </h3>
        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" /> Initialized
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
          <div className="text-slate-400 font-bold">Supabase Project URL</div>
          <div className="font-mono text-slate-800 truncate">{supabaseUrl}</div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
          <div className="text-slate-400 font-bold">Trạng thái Session Client</div>
          <div className="font-bold text-slate-800 flex items-center gap-1.5">
            {loading ? (
              <span className="text-slate-500">Đang đọc phiên làm việc...</span>
            ) : user ? (
              <span className="text-emerald-600 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5" /> Logged In ({user.email})
              </span>
            ) : (
              <span className="text-slate-600 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-ori-600" /> Chưa Đăng Nhập (RLS Active)
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Lỗi Supabase Auth: {error}</span>
        </div>
      )}

      <div className="text-[11px] text-slate-400 font-medium pt-1">
        * Kết nối an toàn qua API Anon Public. Toàn bộ nội dung trả phí được bảo vệ bằng Row Level Security (RLS) trên PostgreSQL.
      </div>
    </div>
  );
};
