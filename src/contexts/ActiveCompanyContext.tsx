import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { apiFetch } from "@/services/activApi";

/**
 * Which company am I acting as — the website's answer to the same question the
 * mobile app answers in `frontend/src/stores/activeCompanyStore.ts`.
 *
 * The website had no answer at all. Every business screen asked
 * `/business-profiles/me`, which returns the member's NEWEST company, and the
 * "Set as Active" button in My Companies was a no-op that faked its own
 * success response:
 *
 *     const response = { ok: true, json: async () => ({ success: true }) };
 *
 * It showed "Company set as active" and changed nothing, which is why
 * switching company appeared to do nothing — there was nothing to switch. The
 * catalog compounded it: `GET /products` with no `companyId` returns every
 * product the member owns, so one company's catalog was mixed with another's.
 *
 * The backend already supports all of this (`GET /products?companyId=`,
 * `/products/stats?companyId=`); only the client was missing. This context is
 * deliberately the same shape and the same reconciliation rules as the mobile
 * store, so the two clients behave identically:
 *
 *   - the selection is persisted, and survives a reload
 *   - a selection that no longer exists falls back to the first company
 *   - concurrent loads share one request, with a short cache, because six
 *     screens each load on mount
 */
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
    status?: string;
    /** Listed in the Discover directory. NOT "is the active company". */
    isActive?: boolean;
    createdAt?: string;
}

const STORAGE_KEY = "activ:activeCompanyId";

const readStoredId = (): string | null => {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        // Private-mode browsers throw rather than returning null.
        return null;
    }
};

const writeStoredId = (id: string | null): void => {
    try {
        if (id) localStorage.setItem(STORAGE_KEY, id);
        else localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* storage unavailable — the selection lives for this page only */
    }
};

interface ActiveCompanyValue {
    companies: ActiveCompany[];
    activeCompanyId: string | null;
    activeCompany: ActiveCompany | null;
    isLoading: boolean;
    hasLoaded: boolean;
    loadCompanies: (options?: { force?: boolean }) => Promise<ActiveCompany[]>;
    setActiveCompany: (id: string | null) => void;
    clear: () => void;
}

const ActiveCompanyContext = createContext<ActiveCompanyValue | null>(null);

/** Repeat loads inside this window reuse what was just fetched. */
const LOAD_TTL_MS = 4000;

export function ActiveCompanyProvider({ children }: { children: ReactNode }) {
    const [companies, setCompanies] = useState<ActiveCompany[]>([]);
    const [activeCompanyId, setActiveCompanyId] = useState<string | null>(() => readStoredId());
    const [isLoading, setIsLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    // Refs, not state: these coordinate requests and must not cause a render.
    const inFlight = useRef<Promise<ActiveCompany[]> | null>(null);
    const lastLoadedAt = useRef(0);
    const activeIdRef = useRef<string | null>(activeCompanyId);
    const companiesRef = useRef<ActiveCompany[]>([]);

    useEffect(() => { activeIdRef.current = activeCompanyId; }, [activeCompanyId]);
    useEffect(() => { companiesRef.current = companies; }, [companies]);

    const loadCompanies = useCallback(async (options?: { force?: boolean }) => {
        const force = options?.force === true;

        if (!force) {
            if (inFlight.current) return inFlight.current;
            if (lastLoadedAt.current && Date.now() - lastLoadedAt.current < LOAD_TTL_MS) {
                return companiesRef.current;
            }
        }

        const request = (async (): Promise<ActiveCompany[]> => {
            setIsLoading(true);
            try {
                const response = await apiFetch("/business-profiles/all");
                const body = await response.json();
                const payload = body?.data ?? [];
                const list: ActiveCompany[] = (Array.isArray(payload) ? payload : [])
                    .filter((c: ActiveCompany) => c && c._id);

                // Keep the current selection if it still exists, else the stored
                // one, else the first company. A selection pointing at a deleted
                // company would leave every screen empty with no way back.
                let nextId = activeIdRef.current || readStoredId();
                if (!list.some((c) => c._id === nextId)) {
                    nextId = list.length > 0 ? list[0]._id : null;
                }

                setCompanies(list);
                setActiveCompanyId(nextId);
                writeStoredId(nextId);
                setHasLoaded(true);
                return list;
            } catch {
                // The caller already has whatever was loaded before; a failed
                // refresh must not blank the screen.
                setHasLoaded(true);
                return companiesRef.current;
            } finally {
                setIsLoading(false);
                lastLoadedAt.current = Date.now();
                inFlight.current = null;
            }
        })();

        inFlight.current = request;
        return request;
    }, []);

    const setActiveCompany = useCallback((id: string | null) => {
        setActiveCompanyId(id);
        writeStoredId(id);
    }, []);

    const clear = useCallback(() => {
        setCompanies([]);
        setActiveCompanyId(null);
        writeStoredId(null);
        setHasLoaded(false);
        lastLoadedAt.current = 0;
    }, []);

    const activeCompany = useMemo(
        () => companies.find((c) => c._id === activeCompanyId) || null,
        [companies, activeCompanyId],
    );

    const value = useMemo<ActiveCompanyValue>(
        () => ({
            companies,
            activeCompanyId,
            activeCompany,
            isLoading,
            hasLoaded,
            loadCompanies,
            setActiveCompany,
            clear,
        }),
        [companies, activeCompanyId, activeCompany, isLoading, hasLoaded, loadCompanies, setActiveCompany, clear],
    );

    return (
        <ActiveCompanyContext.Provider value={value}>
            {children}
        </ActiveCompanyContext.Provider>
    );
}

export function useActiveCompanyStore(): ActiveCompanyValue {
    const ctx = useContext(ActiveCompanyContext);
    if (!ctx) {
        throw new Error("useActiveCompanyStore must be used inside <ActiveCompanyProvider>");
    }
    return ctx;
}

/** The company the member is currently acting as, or null. */
export function useActiveCompany(): ActiveCompany | null {
    return useActiveCompanyStore().activeCompany;
}
