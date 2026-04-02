import { Navigate } from 'react-router-dom';
import { createBrowserRouter } from 'react-router-dom';
import AppShellLayout from '../components/shell/AppShell';
import LoginPage from '../features/auth/LoginPage';
import RoutersPage from '../features/routers/RoutersPage';
import InterfacesPage from '../features/interfaces/InterfacesPage';
import ConfigureLandingPage from '../features/configure/ConfigureLandingPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import TenantSettingsPage from '../features/tenant/TenantSettingsPage';
import UsersPage from '../features/users/UsersPage';
import AuditLogPage from '../features/audit/AuditLogPage';
import { useAuthStore } from '../stores/useAuthStore';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShellLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'configure',
        element: <ConfigureLandingPage />,
      },
      {
        path: 'configure/interfaces',
        element: <InterfacesPage />,
      },
      {
        path: 'routers',
        element: <RoutersPage />,
      },
      {
        path: 'users',
        element: <UsersPage />,
      },
      {
        path: 'audit-log',
        element: <AuditLogPage />,
      },
      {
        path: 'settings',
        element: <TenantSettingsPage />,
      },
    ],
  },
]);
