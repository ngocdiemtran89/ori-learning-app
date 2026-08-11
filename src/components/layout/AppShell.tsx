import React, { useState, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Headphones,
  BookCheck,
  ClipboardCheck,
  User as UserIcon,
  ShieldCheck,
  ShieldAlert,
  Menu,
  X,
  LogOut,
  GraduationCap,
  Sparkles,
  Bookmark,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const AppShell: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userSidebarExpanded, setUserSidebarExpanded] = useState<boolean | null>(null);
  const location = useLocation();
  const { user, profile, isActive, isExpired, isAdmin, signOut } = useAuth();

  // Part 7 Focus Mode detection (active when taking Part 7 runner)
  const isPart7FocusMode = useMemo(() => {
    const isTakeRoute = location.pathname.includes('/take');
    if (!isTakeRoute) return false;
    const searchParams = new URLSearchParams(location.search);
    const mode = searchParams.get('mode');
    const part = searchParams.get('part');
    return mode === 'part' && (part === '7' || part === 'part7');
  }, [location.pathname, location.search]);

  // Sidebar collapsed state: Default collapsed (w-16) ONLY during Part 7 Focus Mode unless user explicitly toggles
  const isSidebarCollapsed = useMemo(() => {
    if (userSidebarExpanded !== null) {
      return !userSidebarExpanded;
    }
    return isPart7FocusMode;
  }, [isPart7FocusMode, userSidebarExpanded]);

  const navItems = [
    { label: 'Tổng quan', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Tiến độ & Phân tích', path: '/progress', icon: BarChart3 },
    { label: 'Từ vựng (Vocab)', path: '/vocabulary', icon: BookOpen },
    { label: 'Sổ tay từ khó', path: '/notebook', icon: Bookmark },
    { label: 'Sổ lỗi sai', path: '/mistakes', icon: AlertTriangle },
    { label: 'Ngữ pháp (Grammar)', path: '/grammar', icon: FileText },
    { label: 'Luyện nghe (Listening)', path: '/listening', icon: Headphones },
    { label: 'Luyện đọc (Reading)', path: '/reading', icon: BookCheck },
    { label: 'Thi thử TOEIC', path: '/tests', icon: ClipboardCheck },
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
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className={isPart7FocusMode ? "w-full max-w-none px-4 h-14 flex items-center justify-between" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"}>
          
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-ori-600 to-sky-400 flex items-center justify-center text-white shadow-md shadow-ori-500/20 group-hover:scale-105 transition-transform shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-extrabold text-base text-slate-900 tracking-tight leading-none group-hover:text-ori-600 transition-colors">
                  ORI Learning
                </span>
                <span className="text-[10px] font-semibold text-ori-600 tracking-wide uppercase mt-0.5">
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

      {/* Main Shell Container (Focus Mode uses max-w-none w-full px-3 py-2 gap-3) */}
      <div className={
        isPart7FocusMode
          ? "flex-1 flex w-full max-w-none px-3 py-2 gap-3 min-h-0 overflow-hidden"
          : "flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-8"
      }>
        
        {/* Desktop Sidebar Navigation (Supports w-16 collapsed icon rail in Focus Mode) */}
        <aside className={`hidden lg:block shrink-0 transition-all duration-200 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}>
          <div className="sticky top-18 bg-white rounded-2xl border border-slate-200 p-2.5 shadow-xs space-y-2">
            
            {/* Collapse/Expand Toggle Button */}
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {!isSidebarCollapsed && <span>Danh mục</span>}
              <button
                type="button"
                onClick={() => setUserSidebarExpanded(isSidebarCollapsed)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors ml-auto cursor-pointer"
                title={isSidebarCollapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
              >
                {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActivePath = location.pathname.startsWith(item.path);

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={item.label}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      isSidebarCollapsed ? 'justify-center px-0' : ''
                    } ${
                      isActivePath
                        ? 'bg-ori-600 text-white shadow-md shadow-ori-600/20'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActivePath ? 'text-white' : 'text-slate-400'}`} />
                    {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </nav>

            {!isSidebarCollapsed && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="bg-sky-50 rounded-xl p-3 border border-sky-100 text-xs">
                  <div className="flex items-center gap-1.5 text-ori-700 font-bold mb-1">
                    <Sparkles className="w-4 h-4 text-ori-600" />
                    Mẹo học TOEIC ORI
                  </div>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Luyện từ vựng 15 phút mỗi ngày cùng Flashcard SRS để đạt mục tiêu 650+ TOEIC!
                  </p>
                </div>
              </div>
            )}
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
        <main className="flex-1 min-w-0 flex flex-col">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
