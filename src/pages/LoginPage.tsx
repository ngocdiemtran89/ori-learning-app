import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { GraduationCap, LogIn, Lock, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, signIn, loading: authLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already logged in, redirect to dashboard
  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Vui lòng nhập đầy đủ Email và Mật khẩu.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(error);
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-ori-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-ori-600 to-sky-400 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-ori-500/30">
            <GraduationCap className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">Đăng Nhập ORI Learning</h1>
          <p className="text-sm text-slate-500 mt-1">Cổng học tập & luyện thi TOEIC học viên ORI</p>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Email học viên
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="student@ori.edu.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-ori-600 focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-ori-600 focus:bg-white transition-all"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 bg-ori-600 hover:bg-ori-700 disabled:bg-slate-400 text-white font-bold text-sm rounded-xl shadow-lg shadow-ori-600/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Đang xác thực...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Đăng nhập vào Hệ thống</span>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 leading-relaxed">
            Chưa có tài khoản hoặc tài khoản hết hạn? Vui lòng liên hệ Giáo vụ Trung tâm ORI để đăng ký cấp quyền.
          </p>
        </div>
      </div>
    </div>
  );
};
