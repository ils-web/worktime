import { create } from 'zustand';
import { AuthUserSession } from '@timetracker/shared';
import { apiRequest } from '../lib/api';

interface AuthState {
  user: AuthUserSession | null;
  isLoading: boolean;
  isInitialized: boolean;
  checkAuth: () => Promise<AuthUserSession | null>;
  logout: () => Promise<void>;
  setUser: (user: AuthUserSession | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isInitialized: false,

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const data = await apiRequest<{ success: boolean; user: AuthUserSession }>('/api/auth/me');
      set({ user: data.user, isLoading: false, isInitialized: true });
      return data.user;
    } catch {
      set({ user: null, isLoading: false, isInitialized: true });
      return null;
    }
  },

  logout: async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      set({ user: null });
      window.location.href = '/login';
    }
  },

  setUser: (user) => set({ user }),
}));
