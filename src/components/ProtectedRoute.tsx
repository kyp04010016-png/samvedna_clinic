import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, StaffRole, getRoleHomeRoute } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles: StaffRole[];
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  children,
}) => {
  const { firebaseUser, userProfile, role, isTrueAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Verifying clinic credentials...</p>
      </div>
    );
  }

  if ((!firebaseUser && !userProfile) || !role) {
    return <Navigate to="/login" replace />;
  }

  if (!isTrueAdmin && !allowedRoles.includes(role)) {
    return <Navigate to={getRoleHomeRoute(role)} replace />;
  }

  return <>{children}</>;
};
