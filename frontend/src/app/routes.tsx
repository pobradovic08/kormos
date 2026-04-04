import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { createBrowserRouter } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import AppShellLayout from '../components/shell/AppShell';
import ErrorPage from '../components/error/ErrorPage';
import ContentErrorPage from '../components/error/ContentErrorPage';
import NotFoundPage from '../components/error/NotFoundPage';
import LoginPage from '../features/auth/LoginPage';
import SetupWizardPage from '../features/setup/SetupWizardPage';
import RoutersPage from '../features/routers/RoutersPage';
import InterfacesPage from '../features/interfaces/InterfacesPage';
import ConfigureLandingPage from '../features/configure/ConfigureLandingPage';
import DashboardPage from '../features/dashboard/DashboardPage';
import TenantSettingsPage from '../features/tenant/TenantSettingsPage';
import UsersPage from '../features/users/UsersPage';
import AuditLogPage from '../features/audit/AuditLogPage';
import { useAuthStore } from '../stores/useAuthStore';
import { usePortalStore } from '../stores/usePortalStore';
import { useSetupStatus, usePortalSettings } from '../features/setup/setupApi';
import type { ReactNode } from 'react';

function SetupGuard({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { data, isLoading } = useSetupStatus();
  const isSetupComplete = data?.setup_complete ?? false;

  const portalSettingsQuery = usePortalSettings();
  const setPortalSettings = usePortalStore((s) => s.setPortalSettings);

  // Populate portal store when settings are loaded
  useEffect(() => {
    if (portalSettingsQuery.data) {
      const ps = portalSettingsQuery.data;
      setPortalSettings(ps.portal_name, ps.default_timezone, ps.support_email);
    }
  }, [portalSettingsQuery.data, setPortalSettings]);

  if (isLoading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!isSetupComplete && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  if (isSetupComplete && location.pathname === '/setup') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export const router = createBrowserRouter([
  {
    errorElement: <ErrorPage />,
    children: [
      {
        path: '/setup',
        element: (
          <SetupGuard>
            <SetupWizardPage />
          </SetupGuard>
        ),
      },
      {
        path: '/login',
        element: (
          <SetupGuard>
            <LoginPage />
          </SetupGuard>
        ),
      },
      {
        path: '/',
        element: (
          <SetupGuard>
            <ProtectedRoute>
              <AppShellLayout />
            </ProtectedRoute>
          </SetupGuard>
        ),
        errorElement: <ContentErrorPage />,
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
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
]);
