// Active Company Store — single source of truth for "which company am I acting as".
//
// Every business screen (dashboard, products, analytics, settings) reads the
// active company from here, so one company's data is NEVER mixed with another's.
// The selection is persisted, so it survives app restarts and only changes when
// the user explicitly switches company.
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { ENDPOINTS } from '../config/api.config';

export interface ActiveCompany {
  _id: string;
  businessName: string;
  businessType?: string;
  mobileNumber?: string;
  email?: string;
  description?: string;
  area?: string;
  location?: string;
  logo?: string;
  banner?: string;
  publication?: { published: boolean; canPublish: boolean; memberActive: boolean; unlimited: boolean; paymentRequired: boolean; publishedCount: number; label: string };
  status?: string;
  isActive?: boolean;
  createdAt?: string;
}

const STORAGE_KEY = '@activ:activeCompanyId';

const readStoredId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Active company read safely caught:', err);
    return null;
  }
};

const writeStoredId = async (id: string | null): Promise<void> => {
  try {
    if (id) {
      await AsyncStorage.setItem(STORAGE_KEY, id);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Active company write safely caught:', err);
  }
};

interface ActiveCompanyState {
  companies: ActiveCompany[];
  activeCompanyId: string | null;
  isLoading: boolean;
  hasLoaded: boolean;

  /** Fetch the signed-in member's companies and reconcile the active selection. */
  loadCompanies: (options?: { force?: boolean }) => Promise<ActiveCompany[]>;
  /** Explicit user-driven switch. Persisted. */
  setActiveCompany: (id: string | null) => void;
  getActiveCompany: () => ActiveCompany | null;
  /** Called on logout / account teardown. */
  clear: () => void;
}

// Shared across every screen: one in-flight request at a time, plus a short
// window during which a repeat call reuses what was just fetched.
const LOAD_TTL_MS = 4000;
let inFlight: Promise<ActiveCompany[]> | null = null;
let lastLoadedAt = 0;

export const useActiveCompanyStore = create<ActiveCompanyState>((set, get) => ({
  companies: [],
  activeCompanyId: null,
  isLoading: false,
  hasLoaded: false,

  loadCompanies: async (options) => {
    // Six business screens each reload the company list when they gain focus,
    // so tabbing around used to fire one request per screen within a couple of
    // seconds - enough to exhaust the API rate limit on its own. Share a single
    // in-flight request and serve a very short-lived cache; an explicit
    // { force: true } (after a create / edit / delete) always goes to the wire.
    const force = options?.force === true;

    if (!force) {
      if (inFlight) return inFlight;
      if (lastLoadedAt && Date.now() - lastLoadedAt < LOAD_TTL_MS) {
        return get().companies || [];
      }
    }

    const request = (async () => {
    set({ isLoading: true });
    try {
      const response = await api.get(`${ENDPOINTS.BUSINESS.CREATE}/all`, {
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
        params: { _t: Date.now() },
      });

      const payload = response.data?.data || response.data || [];
      const list: ActiveCompany[] = (Array.isArray(payload) ? payload : []).filter(
        (c: ActiveCompany) => c && c._id,
      );

      // Keep the current selection if it still exists, else fall back to the
      // persisted one, else the first company.
      let nextId = get().activeCompanyId;
      if (!nextId) {
        nextId = await readStoredId();
      }

      const stillExists = list.some((c) => c._id === nextId);
      if (!stillExists) {
        nextId = list.length > 0 ? list[0]._id : null;
      }

      set({ companies: list, activeCompanyId: nextId, hasLoaded: true });
      await writeStoredId(nextId);
      return list;
    } catch (err) {
      console.warn('Error loading companies:', err);
      set({ hasLoaded: true });
      return get().companies || [];
    } finally {
      set({ isLoading: false });
      lastLoadedAt = Date.now();
      inFlight = null;
    }
    })();

    inFlight = request;
    return request;
  },

  setActiveCompany: (id) => {
    set({ activeCompanyId: id });
    // Fire-and-forget: persistence must never block or crash the UI.
    writeStoredId(id);
  },

  getActiveCompany: () => {
    const { companies, activeCompanyId } = get();
    return (companies || []).find((c) => c._id === activeCompanyId) || null;
  },

  clear: () => {
    set({ companies: [], activeCompanyId: null, hasLoaded: false });
    writeStoredId(null);
  },
}));

/**
 * Selector hook for the active company object. Returns null when the member has
 * no company yet — every consumer must handle that case.
 */
export const useActiveCompany = (): ActiveCompany | null =>
  useActiveCompanyStore(
    (state) => (state.companies || []).find((c) => c._id === state.activeCompanyId) || null,
  );
