import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const AdminRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex bg-slate-50 items-center justify-center h-screen text-slate-800">Загрузка...</div>;
  }

  // If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If logged in but not admin, redirect to dashboard (root)
  if (user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  // Authorized
  return <Outlet />;
};
