/**
 * Authentication against the real ACTIV backend.
 *
 * The signatures here are unchanged so existing callers keep compiling; what
 * changed is where they point. Previously this module hardcoded
 * `http://localhost:4000/api`, a server that no longer exists, which is why
 * every sign-in failed with ERR_CONNECTION_REFUSED and the UI reported it as
 * "invalid email or password".
 *
 * All real work lives in `services/activApi.ts`. This file is a thin
 * compatibility surface over it and should eventually be deleted in favour of
 * importing that module directly.
 */
import api, { clearSession, errorMessage } from '@/services/api';
import {
    login as apiLogin,
    register as apiRegister,
    getMyProfile,
    getAdminProfile,
    getStoredRole,
    isAuthenticated as apiIsAuthenticated,
    forgotPassword as apiForgotPassword,
    resetPassword as apiResetPassword,
    verifyResetToken as apiVerifyResetToken,
} from '@/services/activApi';
import { HOME_FOR_ROLE, type UserRole } from '@/config/api.config';

export interface RegisterData {
    fullName: string;
    email: string;
    phoneNumber: string;
    password: string;
    confirmPassword?: string;
    state?: string;
    district?: string;
    block?: string;
    city?: string;
}

export interface LoginData {
    email: string;
    password: string;
}

export interface UserData {
    id: string;
    fullName: string;
    email: string;
    phoneNumber: string;
    role: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    data?: {
        user: UserData;
        token: string;
        role?: UserRole;
        /** Where this role should land. */
        home?: string;
    };
}

/**
 * Register a new member.
 *
 * The backend refuses a region no active admin covers, and returns a message
 * naming the region — that text is worth showing verbatim rather than replacing
 * with a generic failure, because it tells the applicant exactly what to change.
 */
export const register = async (userData: RegisterData): Promise<AuthResponse> => {
    try {
        const result = await apiRegister({
            fullName: userData.fullName,
            email: userData.email,
            password: userData.password,
            phoneNumber: userData.phoneNumber,
            state: userData.state || '',
            district: userData.district || '',
            block: userData.block || '',
            city: userData.city,
        });

        return {
            success: true,
            message: 'Registration successful',
            data: {
                user: result.user as UserData,
                token: result.token,
                role: result.role,
                home: result.home,
            },
        };
    } catch (error) {
        return { success: false, message: errorMessage(error, 'Registration failed. Please try again.') };
    }
};

/**
 * Sign in. One endpoint, all five roles.
 *
 * There is no separate admin login on this backend — `data.role` says which of
 * member / block_admin / district_admin / state_admin / super_admin signed in,
 * and that is what decides where to navigate.
 */
export const login = async (loginData: LoginData): Promise<AuthResponse> => {
    try {
        const result = await apiLogin(loginData.email, loginData.password);

        return {
            success: true,
            message: 'Login successful',
            data: {
                user: result.user as UserData,
                token: result.token,
                role: result.role,
                home: result.home,
            },
        };
    } catch (error) {
        // errorMessage distinguishes "server said no" from "never reached the
        // server", so a backend that is simply not running stops being reported
        // as a credential problem.
        return { success: false, message: errorMessage(error, 'Login failed. Please try again.') };
    }
};

/**
 * The signed-in account.
 *
 * Not `/auth/me`: that route resolves through a per-process cache and answers
 * 404 once the server has restarted. Members read their profile, admins read
 * theirs — both hit the database.
 */
export const getCurrentUser = async (): Promise<UserData | null> => {
    try {
        const role = getStoredRole();
        const profile = role && role !== 'member' ? await getAdminProfile() : await getMyProfile();
        return (profile as UserData) || null;
    } catch {
        return null;
    }
};

export const logout = () => {
    api.post('/auth/logout').catch(() => null);
    clearSession();
    window.location.href = '/login';
};

export const isAuthenticated = (): boolean => apiIsAuthenticated();

export const getUserRole = (): string | null => getStoredRole();

/** Where the signed-in role belongs, for redirects after login. */
export const getHomeRoute = (): string => {
    const role = getStoredRole();
    return (role && HOME_FOR_ROLE[role]) || '/member/unpaid-dashboard';
};

export const forgotPassword = apiForgotPassword;
export const resetPassword = apiResetPassword;
export const verifyResetToken = apiVerifyResetToken;

export default api;
