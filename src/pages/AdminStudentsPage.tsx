import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ArrowLeft, Users, Search, Edit2, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { Profile } from '../lib/supabase/types';
import { getAllStudentProfiles } from '../lib/supabase/admin';
import { LoadingState } from '../components/ui/LoadingState';
import { EmptyState } from '../components/ui/EmptyState';
import { EditStudentModal } from '../components/admin/EditStudentModal';

export const AdminStudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchStudents = async () => {
    const data = await getAllStudentProfiles();
    setStudents(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleUpdateSuccess = () => {
    setToastMessage('Đã cập nhật hồ sơ học viên thành công!');
    fetchStudents();
    setTimeout(() => setToastMessage(null), 3000);
  };

  const filteredStudents = students.filter((st) => {
    const name = st.full_name?.toLowerCase() || '';
    const query = searchQuery.toLowerCase();
    return name.includes(query) || st.id.includes(query);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <NavLink
          to="/admin"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-ori-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Quay lại Bảng Admin
        </NavLink>
        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> Quyền Admin RLS Active
        </span>
      </div>

      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-ori-600" /> Danh Sách Hồ Sơ Học Viên ({students.length})
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Quản lý trình độ, ngày bắt đầu và gia hạn thời gian truy cập cho học viên.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm theo tên học viên..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-ori-600"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState message="Đang lấy danh sách học viên từ cơ sở dữ liệu Supabase..." />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title="Không tìm thấy học viên"
            description="Chưa có hồ sơ học viên nào hoặc từ khóa tìm kiếm không khớp."
            icon={Users}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Học viên</th>
                  <th className="py-3 px-4">Vai trò / Level</th>
                  <th className="py-3 px-4">Ngày bắt đầu</th>
                  <th className="py-3 px-4">Hạn truy cập</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredStudents.map((st) => {
                  const expiresDate = st.access_expires_at
                    ? new Date(st.access_expires_at).toLocaleDateString('vi-VN')
                    : 'Không thời hạn';
                  const startDate = st.access_start_at
                    ? new Date(st.access_start_at).toLocaleDateString('vi-VN')
                    : 'N/A';

                  const isExpired = st.access_expires_at
                    ? new Date(st.access_expires_at) <= new Date()
                    : false;

                  return (
                    <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {st.full_name || 'Học viên ORI'}
                        <div className="text-[11px] font-normal text-slate-400 font-mono">
                          {st.id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700 capitalize">{st.level}</span>
                        <div className="text-[10px] text-slate-400 font-bold uppercase">{st.role}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{startDate}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{expiresDate}</td>
                      <td className="py-3.5 px-4">
                        {st.status === 'active' ? (
                          isExpired ? (
                            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-extrabold uppercase">
                              Hết hạn
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold uppercase">
                              Active
                            </span>
                          )
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-extrabold uppercase">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedStudent(st)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-ori-50 text-slate-700 hover:text-ori-600 rounded-lg text-xs font-bold inline-flex items-center gap-1 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Sửa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Student Modal */}
      {selectedStudent && (
        <EditStudentModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onSuccess={handleUpdateSuccess}
        />
      )}
    </div>
  );
};
