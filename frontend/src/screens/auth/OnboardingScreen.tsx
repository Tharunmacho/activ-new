import React, { useEffect } from 'react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../../services/api';
import { ENDPOINTS } from '../../config/api.config';
import { homeForRole, clearSession, isAdminRole } from '../../services/session';
import { RootStackParamList } from '../../types';
import StartupScreen from '../../components/StartupScreen';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};
const RESTORE_TIMEOUT_MS = 10000;

/** Restore the session before showing its home, using the shared startup view. */
export default function OnboardingScreen({ navigation }: Props) {
  useEffect(() => {
    let cancelled = false;
    const current = () =>
      !cancelled &&
      (typeof navigation.isFocused !== 'function' || navigation.isFocused());
    const restore = async () => {
      try {
        const [token, role] = await Promise.all([
          AsyncStorage.getItem('@activ_auth_token'),
          AsyncStorage.getItem('@activ_user_role'),
          // Older builds stored a password; never retain that legacy value.
          AsyncStorage.removeItem('@activ_user_password').catch(() => null),
        ]);
        if (!current()) return;
        if (!token || !role) {
          navigation.replace('PublicExplore');
          return;
        }

        try {
          await api.get(ENDPOINTS.AUTH.PROFILE, {
            timeout: RESTORE_TIMEOUT_MS,
          });
        } catch (error: any) {
          if (error?.response?.status === 401) {
            // The API layer clears invalid credentials. Also route explicitly
            // if its redirect happened before the navigator was ready.
            if (current())
              navigation.replace(isAdminRole(role) ? 'AdminLogin' : 'Login');
            return;
          }
          // Keep the existing offline fallback. The home screen supplies retry
          // states; startup must not inherit the global 75-second API timeout.
        }
        if (!current()) return;
        const home = await homeForRole(role, undefined, RESTORE_TIMEOUT_MS);
        if (!current()) return;
        if (!home) {
          await clearSession();
          if (current()) navigation.replace('PublicExplore');
          return;
        }
        navigation.reset({ index: 0, routes: [{ name: home }] });
      } catch {
        if (current()) navigation.replace('PublicExplore');
      }
    };
    void restore();
    return () => {
      cancelled = true;
    };
  }, [navigation]);

  return <StartupScreen />;
}
