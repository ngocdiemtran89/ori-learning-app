import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Headphones,
  BookCheck,
  User as UserIcon,
  ShieldAlert,
  ShieldCheck,
  Menu,
  X,
  LogOut,
  GraduationCap,
  Sparkles,
  Bookmark,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const AppShell: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { user, profile, isActive, isExpired, isAdmin, signOut } = useAuth();

  const navItems = [
    { label: 'Tổng quan', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Từ vựng (Vocab)', path: '/vocabulary', icon: BookOpen },
    { label: 'Sổ tay từ khó', path: '/notebook', icon: Bookmark },
    { label: 'Sổ lỗi sai', path: '/mistakes', icon: AlertTriangle },
    { label: 'Ngữ pháp (Grammar)', path: '/grammar', icon: FileText },
    { label: 'Luyện nghe (Listening)', path: '/listening', icon: Headphones },
    { label: 'Luyện đọc (Reading)', path: '/reading', icon: BookCheck },
    { label: 'Tài khoản', path: '/account', icon: UserIcon },
  ];

  if (isAdmin) {
    navItems.push({ label: 'Quản trị Admin', path: '/admin', icon: ShieldCheck });
  }

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Học viên ORI';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Mobile Menu Toggle */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-ori-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="Toggle mobile menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-ori-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-ori-500/20 group-hover:scale-105 transition-transform">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-lg text-slate-900 tracking-tight leading-none group-hover:text-ori-600 transition-colors">
                  ORI Learning
                </span>
                <span className="text-[11px] font-semibold text-ori-600 tracking-wide uppercase mt-0.5">
                  TOEIC Student Portal
                </span>
              </div>
            </NavLink>
          </div>

          {/* User Expiry Status & Quick Controls */}
          <div className="flex items-center gap-3">
            {isActive ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>{displayName}</span>
              </div>
            ) : isExpired ? (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>Hết hạn truy cập</span>
              </div>
            ) : null}

            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4 text-slate-400 hover:text-rose-600" />
              <span className="hidden md:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Shell Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-8">
        
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-22 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <div className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Danh mục học tập
            </div>

            <nav className="space-y-1 mt-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActivePath = location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isActivePath
                        ? 'bg-ori-600 text-white shadow-md shadow-ori-600/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActivePath ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="bg-sky-50 rounded-xl p-3.5 border border-sky-100 text-xs">
                <div className="flex items-center gap-1.5 text-ori-700 font-bold mb-1">
                  <Sparkles className="w-4 h-4 text-ori-600" />
                  Mẹo học TOEIC ORI
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Luyện từ vựng 15 phút mỗi ngày cùng Flashcard SRS để đạt mục tiêu 650+ TOEIC!
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Slide-Over Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={closeMobileMenu} />

            <div className="relative bg-white w-4/5 max-w-sm p-6 flex flex-col h-full z-10 shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-6 h-6 text-ori-600" />
                  <span className="font-extrabold text-slate-900">ORI Learning</span>
                </div>
                <button onClick={closeMobileMenu} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="space-y-1.5 flex-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActivePath = location.pathname.startsWith(item.path);

                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={closeMobileMenu}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                        isActivePath
                          ? 'bg-ori-600 text-white shadow-md shadow-ori-600/20'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    closeMobileMenu();
                    signOut();
                  }}
                  className="w-full flex items-center gap-2 text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 p-3 rounded-xl hover:bg-rose-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Đăng xuất tài khoản</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
