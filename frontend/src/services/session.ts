import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { STORAGE_KEYS } from './api';
import { ENDPOINTS } from '../config/api.config';

/**
 * ============================================================================
 * WHO IS SIGNED IN, AND WHERE THEY LAND — one answer for the whole app
 * ============================================================================
 *
 * Mirrors the website exactly (same backend, same database):
 *
 *   Member sign-in  (LoginScreen)       POST /auth/login { …, portal: 'member' }
 *   Admin sign-in   (AdminLoginScreen)  POST /auth/login { …, portal: 'admin' }
 *
 * The SERVER refuses the wrong screen before any token is issued (a member on
 * the admin screen, an admin on the member screen), with its own sentence.
 *
 * Where each account lands:
 *   member         paid (membershipStatus active/completed, and the renewal is
 *                  not expired) → PaidDashboard, otherwise → MemberMain
 *                  (the unpaid dashboard). Read from GET /members/my-profile,
 *                  the same answer the website's getPaymentStatus() uses.
 *   block_admin    → BlockDashboard
 *   district_admin → DistrictDashboard
 *   state_admin    → StateDashboard
 *   super_admin    → SuperAdminDashboard
 *   attendance_admin → EventsAdminHome — Event Attendance Administration:
 *                  check-in at the door (scan the attendees' QR entry
 *                  passes) and attendance. A MOBILE-ONLY account; the
 *                  website refuses it.
 *   anything else  (the CMS and events admin accounts, which run the
 *                  website) → not served by the app; the caller
 *                  signs them out and says to use the website.
 *
 * Login, the admin login and the startup restore all route through here, so
 * the three can never disagree about where an account belongs.
 */

export type Portal = 'member' | 'admin';

export type HomeRoute =
  | 'PaidDashboard'
  | 'MemberMain'
  | 'BlockDashboard'
  | 'DistrictDashboard'
  | 'StateDashboard'
  | 'SuperAdminDashboard'
  | 'EventsAdminHome';

export const ADMIN_HOME: Record<string, HomeRoute> = {
  block_admin: 'BlockDashboard',
  district_admin: 'DistrictDashboard',
  state_admin: 'StateDashboard',
  super_admin: 'SuperAdminDashboard',
  attendance_admin: 'EventsAdminHome',
};

export const isAdminRole = (role?: string | null) => !!ADMIN_HOME[String(role || '')];

/** The message for an account the app deliberately does not serve. */
export const UNSUPPORTED_ACCOUNT_MESSAGE =
  'This account is managed on the ACTIV website. Please sign in at activ.org.in.';

/**
 * Paid, by the website's rule: active/completed AND the renewal not expired.
 * Unknown is unpaid — showing paid-only screens to someone who has not paid is
 * the worse failure.
 */
export const isPaidProfile = (profile: any): boolean => {
  const status = String(profile?.membershipStatus || '').toLowerCase();
  if (String(profile?.renewal?.state || '') === 'expired') return false;
  return status === 'active' || status === 'completed';
};

/** Paid or unpaid dashboard for a signed-in member (token already stored). */
export const memberHome = async (fallbackDetails?: any, timeoutMs?: number): Promise<HomeRoute> => {
  try {
    const res = await api.get(ENDPOINTS.MEMBERS.MY_PROFILE, timeoutMs ? { timeout: timeoutMs } : undefined);
    const profile = res?.data?.data || res?.data || {};
    return isPaidProfile(profile) ? 'PaidDashboard' : 'MemberMain';
  } catch {
    return isPaidProfile(fallbackDetails) ? 'PaidDashboard' : 'MemberMain';
  }
};

/** The landing route for a role, or null when the app does not serve it. */
export const homeForRole = async (role?: string | null, memberDetails?: any, timeoutMs?: number): Promise<HomeRoute | null> => {
  const r = String(role || '').toLowerCase();
  if (r === 'member') return memberHome(memberDetails, timeoutMs);
  return ADMIN_HOME[r] || null;
};

/** Forget everything about the current session on this device. */
export const clearSession = async (): Promise<void> => {
  await require('./pushNotifications').detachPushDevice();
  await require('./analytics').analyticsLogout();
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.AUTH_TOKEN,
      STORAGE_KEYS.USER_DATA,
      STORAGE_KEYS.USER_ROLE,
      // Older builds kept the password in plain text; never again, and never
      // leave the old copy behind.
      '@activ_user_password',
    ]);
  } catch (err) {
    console.warn('Session clear safely caught:', err);
  }
};

/** The user object as stored: never with a password in it. */
export const sanitizeUser = (user: any) => {
  const { password, confirmPassword, currentPassword, ...rest } = user || {};
  return rest;
};
