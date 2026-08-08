import React, { useState } from 'react';
import { X, Calendar, Shield, Save, AlertTriangle, Loader2 } from 'lucide-react';
import { Profile, AccountStatus } from '../../lib/supabase/types';
import { updateStudentProfile } from '../../lib/supabase/admin';

interface EditStudentModalProps {
  student: Profile;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditStudentModal: React.FC<EditStudentModalProps> = ({
  student,
  onClose,
  onSuccess,
}) => {
  const [level, setLevel] = useState<string>(student.level || 'foundation');
  const [status, setStatus] = useState<AccountStatus>(student.status || 'active');
  const [expiresDate, setExpiresDate] = useState<string>(
    student.access_expires_at ? student.access_expires_at.split('T')[0] : ''
  );

  const [showConfirmDisable, setShowConfirmDisable] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleQuickExtend = (days: number) => {
    const baseDate = expiresDate ? new Date(expiresDate) : new Date();
    baseDate.setDate(baseDate.getDate() + days);
    setExpiresDate(baseDate.toISOString().split('T')[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Require confirmation before disabling
    if (status === 'disabled' && student.status !== 'disabled' && !showConfirmDisable) {
      setShowConfirmDisable(true);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const isoExpires = expiresDate ? new Date(expiresDate).toISOString() : null;

    const { success, error } = await updateStudentProfile(student.id, {
      level,
      status,
      access_expires_at: isoExpires,
    });

    setIsSubmitting(false);

    if (success) {
      onSuccess();
      onClose();
    } else {
      setErrorMessage(error || 'Cập nhật thông tin thất bại.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-3xl w-full max-w-lg p-6 sm:p-8 shadow-2xl z-10 border border-slate-100 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg">Cập Nhật Hồ Sơ Học Viên</h3>
            <p className="text-xs text-slate-500">{student.full_name || 'Học viên'} (ID: {student.id.slice(0, 8)}...)</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            {errorMessage}
          </div>
        )}

        {showConfirmDisable && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-amber-800 font-extrabold text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Xác nhận khóa tài khoản
            </div>
            <p className="text-xs text-amber-700 leading-relaxed">
              Bạn có chắc chắn muốn chuyển trạng thái tài khoản học viên sang <strong>DISABLED (Khóa)</strong>? Học viên sẽ bị khóa quyền đọc nội dung bài học.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmDisable(false)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow-sm"
              >
                Xác nhận Khóa
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Level Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Trình độ (Level)
            </label>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-ori-600"
            >
              <option value="foundation">Foundation (Mất gốc → 400)</option>
              <option value="intermediate">Intermediate (400 → 550)</option>
              <option value="upper">Upper (550 → 650+)</option>
            </select>
          </div>

          {/* Account Status Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Trạng thái tài khoản (Status)
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setStatus('active');
                  setShowConfirmDisable(false);
                }}
                className={`p-3 rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                  status === 'active'
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <Shield className="w-4 h-4" /> Active (Hoạt động)
              </button>

              <button
                type="button"
                onClick={() => setStatus('disabled')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                  status === 'disabled'
                    ? 'bg-rose-50 border-rose-400 text-rose-700'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4" /> Disabled (Khóa)
              </button>
            </div>
          </div>

          {/* Expiration Date & Quick Extend */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Ngày hết hạn (Access Expires At)
              </label>
              <div className="flex gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => handleQuickExtend(30)}
                  className="px-2 py-0.5 bg-sky-50 text-ori-600 rounded font-bold hover:bg-sky-100"
                >
                  +30 Ngày
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickExtend(60)}
                  className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded font-bold hover:bg-indigo-100"
                >
                  +60 Ngày
                </button>
              </div>
            </div>

            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={expiresDate}
                onChange={(e) => setExpiresDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-ori-600"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-ori-600 hover:bg-ori-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Cập nhật Hồ sơ</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
