import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingState } from '../ui/LoadingState';

/**
 * RequireAuth: Ensures user is authenticated via Supabase Auth
 */
export const RequireAuth: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Đang kiểm tra thông tin tài khoản..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

/**
 * RequireActiveAccess: Ensures student account status is active and access date is not expired
 */
export const RequireActiveAccess: React.FC = () => {
  const { loading, isActive, isExpired, isDisabled, isAdmin } = useAuth();

  if (loading) {
    return <LoadingState message="Đang xác minh thời hạn truy cập..." />;
  }

  // Admins & Active students pass
  if (isAdmin || isActive) {
    return <Outlet />;
  }

  // Expired or Disabled students are sent to /expired
  if (isExpired || isDisabled) {
    return <Navigate to="/expired" replace />;
  }

  // Default fallback if profile is missing/invalid
  return <Navigate to="/expired" replace />;
};

/**
 * RequireAdmin: Ensures user role is 'admin' and status is 'active'
 */
export const RequireAdmin: React.FC = () => {
  const { loading, isAdmin } = useAuth();

  if (loading) {
    return <LoadingState message="Đang xác minh quyền quản trị..." />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};
