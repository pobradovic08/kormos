import { create } from 'zustand';
import type { AuthUser } from '../api/types';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
}

function loadInitialState(): { user: AuthUser | null; accessToken: string | null } {
  const token = localStorage.getItem('access_token');
  const userJson = localStorage.getItem('auth_user');

  if (token && userJson) {
    try {
      const user = JSON.parse(userJson) as AuthUser;
      return { user, accessToken: token };
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('auth_user');
    }
  }

  return { user: null, accessToken: null };
}

const initial = loadInitialState();

export const useAuthStore = create<AuthState>((set) => ({
  user: initial.user,
  accessToken: initial.accessToken,
  isAuthenticated: initial.user !== null && initial.accessToken !== null,

  setAuth: (user: AuthUser, token: string) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user, accessToken: token, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('auth_user');
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
}));
