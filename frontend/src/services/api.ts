import { DeviceEventEmitter } from 'react-native';
import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_TIMEOUT } from '../config/api.config';

// Storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: '@activ_auth_token',
  USER_DATA: '@activ_user_data',
  USER_ROLE: '@activ_user_role',
};

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config) => {
    try {
      // Add auth token to headers
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
/*
 * A 401 on anything but a sign-in attempt means the session is gone (expired,
 * signed out elsewhere, or the account was blocked). Forget it and send the
 * person to the sign-in screen THEY use — admins to the admin sign-in, members
 * to the member one — instead of leaving a screen whose every request fails.
 * Guarded so a burst of parallel 401s resets once.
 */
let redirectingToLogin = false;
const AUTH_ATTEMPT = /\/auth\/(login|register|forgot-password|reset-password|check-availability|oauth)/;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    try {
      const status = error?.response?.status;
      const requestUrl = error?.config?.url || '';
      if (status === 401 && !AUTH_ATTEMPT.test(requestUrl)) {
        const hadToken = !!(await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN));
        const role = (await AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE)) || '';
        await require('./pushNotifications').detachPushDevice(false);
        await require('./analytics').analyticsLogout();
        await AsyncStorage.multiRemove([
          STORAGE_KEYS.AUTH_TOKEN,
          STORAGE_KEYS.USER_DATA,
          STORAGE_KEYS.USER_ROLE,
          '@activ_user_password',
        ]);
        if (hadToken && !redirectingToLogin) {
          redirectingToLogin = true;
          // Lazy require: navigationRef imports types only, but keep this
          // module free of navigation at load time.
          const { resetTo } = require('../navigation/navigationRef');
          const isAdmin = ['block_admin', 'district_admin', 'state_admin', 'super_admin'].includes(role);
          resetTo(isAdmin ? 'AdminLogin' : 'Login');
          setTimeout(() => { redirectingToLogin = false; }, 3000);
        }
      }
    } catch (err) {
      console.warn('401 handling safely caught:', err);
    }
    return Promise.reject(error);
  }
);

// Helper functions for token management
export const setAuthToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    DeviceEventEmitter.emit('activ:session-changed');
  } catch (error) {
    console.error('Error saving auth token:', error);
  }
};

export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

export const removeAuthToken = async (): Promise<void> => {
  try {
    await require('./pushNotifications').detachPushDevice();
    await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    DeviceEventEmitter.emit('activ:session-changed');
  } catch (error) {
    console.error('Error removing auth token:', error);
  }
};

export const setUserData = async (userData: any): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    DeviceEventEmitter.emit('activ:session-changed');
  } catch (error) {
    console.error('Error saving user data:', error);
  }
};

export const getUserData = async (): Promise<any | null> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

export const setUserRole = async (role: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
  } catch (error) {
    console.error('Error saving user role:', error);
  }
};

export const getUserRole = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.USER_ROLE);
  } catch (error) {
    console.error('Error getting user role:', error);
    return null;
  }
};

export default api;
