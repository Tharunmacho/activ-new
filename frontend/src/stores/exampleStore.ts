import { analyticsLogin, analyticsLogout } from '../services/analytics';
import { detachPushDevice } from '../services/pushNotifications';
import { create } from 'zustand';
import { User, UserRole } from '../types';
import {
  setAuthToken,
  setUserData,
  setUserRole,
  getUserData,
  getUserRole,
  getAuthToken,
  removeAuthToken,
  STORAGE_KEYS,
} from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useActiveCompanyStore } from './activeCompanyStore';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  login: (user: User, token: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  loadUserFromStorage: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  
  setUser: (user) => set({ user }),
  
  setToken: (token) => set({ token, isAuthenticated: !!token }),
  
  login: async (user, token, role) => {
    try {
      await setAuthToken(token);
      await setUserData(user);
      await setUserRole(role);
      void analyticsLogin(user);
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },
  
  logout: async () => {
    await detachPushDevice();
    await analyticsLogout();
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.AUTH_TOKEN,
        STORAGE_KEYS.USER_DATA,
        STORAGE_KEYS.USER_ROLE,
      ]);
      // Never let the next signed-in user inherit this user's active company
      try {
        useActiveCompanyStore.getState().clear();
      } catch (err) {
        console.warn('Active company clear safely caught:', err);
      }
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },
  
  loadUserFromStorage: async () => {
    try {
      const [token, userData, role] = await Promise.all([
        getAuthToken(),
        getUserData(),
        getUserRole(),
      ]);
      
      if (token && userData) {
        set({
          user: userData,
          token,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Load user error:', error);
      set({ isLoading: false });
    }
  },
  
  updateUser: async (updates) => {
    const { user } = get();
    if (user) {
      const updatedUser = { ...user, ...updates };
      await setUserData(updatedUser);
      set({ user: updatedUser });
    }
  },
}));
