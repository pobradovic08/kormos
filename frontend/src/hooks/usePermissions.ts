import { useAuthStore } from '../stores/useAuthStore';

export interface Permissions {
  canUndo: boolean;
  canEditConfig: boolean;
  canManageUsers: boolean;
  canManageRouters: boolean;
  canManageTenant: boolean;
  isViewer: boolean;
  isOperator: boolean;
  isAdmin: boolean;
  isOwner: boolean;
}

export function usePermissions(): Permissions {
  const role = useAuthStore((s) => s.user?.role ?? 'viewer');

  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const isOperator = role === 'operator';
  const isViewer = role === 'viewer';

  return {
    // viewer = read only
    // operator = can edit config (changes apply immediately)
    // admin = edit + undo anyone's changes + manage routers
    // owner = everything
    canUndo: isAdmin || isOwner,
    canEditConfig: isOperator || isAdmin || isOwner,
    canManageUsers: isAdmin || isOwner,
    canManageRouters: isAdmin || isOwner,
    canManageTenant: isOwner,
    isViewer,
    isOperator,
    isAdmin,
    isOwner,
  };
}
