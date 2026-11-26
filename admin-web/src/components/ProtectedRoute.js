import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, loading, user, activeBusinessId } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // SUPPORT is the hidden platform identity with full cross-tenant access.
  // A platform admin inside a selected business is allowed into owner-only
  // pages without changing its underlying role.
  if (allowedRoles && user) {
    const isPlatformRole = user.role === 'SUPER_ADMIN' || user.role === 'SUPPORT';
    const permitted = user.role === 'SUPPORT' ||
      allowedRoles.includes(user.role) ||
      (isPlatformRole && Boolean(activeBusinessId) && allowedRoles.includes('BUSINESS_OWNER'));
    if (!permitted) {
      const defaultRedirect = user.role === 'SUPER_ADMIN'
        ? (activeBusinessId ? '/dashboard' : '/super-admin/dashboard')
        : '/dashboard';
      return <Navigate to={defaultRedirect} replace />;
    }
  }

  return children;
};
