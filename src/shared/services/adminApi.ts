/**
 * Admin operations against the real ACTIV backend.
 *
 * The exported names and shapes are unchanged so existing pages keep compiling.
 * What changed is the target: this module used to point at
 * `http://localhost:4000/api`, a retired server, and in particular called
 * `POST /api/admin/login` — an endpoint that has never existed on this backend.
 *
 * Two corrections matter for anyone reading the pages:
 *
 * 1. **There is no separate admin login.** `POST /auth/login` authenticates all
 *    five roles: it checks the member `auth` collection first, then every admin
 *    collection across both databases, and reports which it found in
 *    `data.role`. `adminLogin` below is kept only so existing callers still
 *    work; it delegates to the one login and re-wraps the answer.
 *
 * 2. **Dashboards are geofenced per tier.** There is no single
 *    `/admin/dashboard/stats`; each role reads its own endpoint and only ever
 *    sees its own region. `getDashboardStats` picks the right one from the
 *    stored role.
 */
import api, { unwrap, errorMessage, clearSession } from '@/services/api';
import {
    login as unifiedLogin,
    getAdminDashboard,
    getAdminProfile,
    listApplications,
    getApplication as fetchApplication,
    approveApplication as apiApprove,
    rejectApplication as apiReject,
    getAdminUsers,
    getStoredRole,
} from '@/services/activApi';
import { STORAGE_KEYS, type UserRole } from '@/config/api.config';

export interface AdminData {
    id: string;
    fullName: string;
    email: string;
    role: string;
    state?: string;
    district?: string;
    block?: string;
    phoneNumber?: string;
    /**
     * Legacy seeded admin documents keep their region under `meta` rather than
     * at the top level, so pages read `admin.meta?.state || admin.state`. The
     * backend's `toAdminRow` already flattens this for accounts it knows about;
     * the field stays declared for the records that predate it.
     */
    meta?: {
        state?: string;
        district?: string;
        block?: string;
        [key: string]: any;
    };
}

export interface AdminLoginResponse {
    success: boolean;
    message?: string;
    data?: { admin: AdminData; token: string };
}

export interface AdminInfoResponse {
    success: boolean;
    data?: AdminData;
    message?: string;
}

export interface DashboardStatsResponse {
    success: boolean;
    data?: Record<string, any>;
    message?: string;
}

export interface ApplicationsResponse {
    success: boolean;
    data?: any[];
    /** How many the tier can see, so a caller need not length-check `data`. */
    count?: number;
    message?: string;
}

export interface ApplicationResponse {
    success: boolean;
    data?: any;
    message?: string;
}

/**
 * Sign in an admin.
 *
 * Delegates to the one unified login. The old `{ data: { admin, token } }`
 * envelope is rebuilt here so callers do not have to change; new code should
 * call `activApi.login` and read `role` directly.
 */
export const adminLogin = async (email: string, password: string): Promise<AdminLoginResponse> => {
    const result = await unifiedLogin(email, password);

    // A member signing in is not an admin. Saying so explicitly stops a member
    // being handed an admin dashboard route they would only get 403s from.
    const adminRoles: UserRole[] = ['block_admin', 'district_admin', 'state_admin', 'super_admin'];
    if (!adminRoles.includes(result.role)) {
        return { success: false, message: 'This account is not an admin account' };
    }

    const admin: AdminData = {
        id: String(result.user.id || result.user._id || ''),
        fullName: result.user.fullName || '',
        email: result.user.email || '',
        role: result.role,
        state: result.user.state,
        district: result.user.district,
        block: result.user.block,
        phoneNumber: result.user.phoneNumber,
    };

    try {
        // Mirrored under the legacy keys some pages still read.
        localStorage.setItem('adminToken', result.token);
        localStorage.setItem('adminData', JSON.stringify(admin));
    } catch { /* storage unavailable */ }

    return { success: true, data: { admin, token: result.token } };
};

export const getAdminInfo = async (): Promise<AdminInfoResponse> => {
    try {
        const profile = await getAdminProfile();
        return { success: true, data: profile as AdminData };
    } catch (error) {
        return { success: false, message: errorMessage(error, 'Could not load the admin profile') };
    }
};

/** The caller's own geofenced dashboard stats, chosen by their role. */
export const getDashboardStats = async (): Promise<DashboardStatsResponse> => {
    try {
        const dashboard = await getAdminDashboard();

        // An admin whose region could not be resolved gets an empty dashboard
        // and an explanation. Surfacing it is important: showing zeroes with no
        // reason looks like "no applications" rather than "no region on record".
        if (dashboard.scopeUnresolved) {
            return { success: false, data: dashboard.stats || {}, message: dashboard.message };
        }

        return { success: true, data: dashboard.stats || {} };
    } catch (error) {
        return { success: false, message: errorMessage(error, 'Could not load dashboard stats') };
    }
};

/**
 * The applications this admin may act on.
 *
 * Reads the tier dashboard rather than the raw list, because the dashboard is
 * where the per-tier bucketing lives: the same application shows a different
 * stage to each tier, and the server has already worked that out.
 */
export const getApplications = async (): Promise<ApplicationsResponse> => {
    try {
        const dashboard = await getAdminDashboard();
        const all = dashboard.applicants?.all || [];
        return { success: true, data: all, count: all.length };
    } catch (error) {
        return { success: false, message: errorMessage(error, 'Could not load applications') };
    }
};

export const getApplicationById = async (applicationId: string): Promise<ApplicationResponse> => {
    try {
        return { success: true, data: await fetchApplication(applicationId) };
    } catch (error) {
        return { success: false, message: errorMessage(error, 'Could not load the application') };
    }
};

/**
 * Approve. The caller's role decides which tier's review runs, so one button
 * works on every admin dashboard without the client knowing the current stage.
 */
export const approveApplication = async (applicationId: string, _comment?: string): Promise<ApplicationResponse> => {
    try {
        return { success: true, data: await apiApprove(applicationId) };
    } catch (error) {
        return { success: false, message: errorMessage(error, 'Could not approve the application') };
    }
};

export const rejectApplication = async (applicationId: string, reason: string): Promise<ApplicationResponse> => {
    try {
        return { success: true, data: await apiReject(applicationId, reason) };
    } catch (error) {
        return { success: false, message: errorMessage(error, 'Could not reject the application') };
    }
};

export const getApplicationStats = async (): Promise<any> => {
    try {
        const dashboard = await getAdminDashboard();
        const { pending = [], approved = [], rejected = [], all = [] } = dashboard.applicants || ({} as any);
        return {
            success: true,
            data: {
                pending: pending.length,
                approved: approved.length,
                rejected: rejected.length,
                total: all.length,
            },
        };
    } catch (error) {
        return { success: false, message: errorMessage(error, 'Could not load application stats') };
    }
};

export const getMembers = async (): Promise<any> => {
    try {
        const { users } = await getAdminUsers();
        return { success: true, data: users };
    } catch (error) {
        return { success: false, message: errorMessage(error, 'Could not load members') };
    }
};

export const adminLogout = () => {
    api.post('/auth/logout').catch(() => null);
    clearSession();
};

export const isAdminLoggedIn = (): boolean => {
    try {
        const role = getStoredRole();
        return !!localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) && !!role && role !== 'member';
    } catch {
        return false;
    }
};

export const getStoredAdminData = (): AdminData | null => {
    try {
        const raw = localStorage.getItem('adminData');
        return raw ? (JSON.parse(raw) as AdminData) : null;
    } catch {
        return null;
    }
};

export default api;
