import { useLayoutEffect, useSyncExternalStore } from 'react';

/**
 * LIGHT / DARK FOR EVERY SIGNED-IN AREA — one store, one key, one class.
 *
 * The CMS has had a theme switch for a while. The member area, the business
 * area and all five admin portals now share it, and this module is the single
 * place that decides what the document root looks like.
 *
 * ONE KEY, SHARED WITH THE CMS. `cms_theme_v2` is the key the CMS already
 * writes, so an editor who chose dark there finds the member area and the admin
 * portals dark as well, and vice versa. The value is `'dark'` or `'light'`; any
 * other value, a missing key, or storage that throws (a private window) reads
 * as LIGHT. There is deliberately no "follow the system" mode: the product
 * opens light for everyone and darkness is something a person asks for.
 *
 * THE CLASS GOES ON `<html>`, NOT ON A WRAPPER. Radix portals (dialogs, selects,
 * popovers, tooltips) and sonner toasts render at the end of `<body>`, outside
 * any subtree a layout could mark, so a class on a wrapper could never reach
 * them. `html.dark` turns on Tailwind's `dark:` variants and the shadcn tokens;
 * `html[data-app-theme="dark"]` additionally turns on the remap of the plain
 * light utilities in `styles/app-dark.css`. The CMS sets only `.dark` (it
 * carries its own palette), so it is untouched by that remap.
 *
 * SCOPED TO THE SIGNED-IN AREA. Nothing is applied until an `<AppThemeScope>` is
 * mounted — RoleGate mounts one around every member and admin route group — and
 * it is taken off again when the last scope unmounts, so the marketing site and
 * the login pages stay light however the preference is set.
 *
 * TWO WAYS TO BE LIGHT ANYWAY:
 *   - `useForceLightTheme()` for a page that is a document (a certificate, a
 *     tax receipt) and must look the same on screen as it prints.
 *   - printing: `beforeprint` drops the theme and `afterprint` restores it, so
 *     any page printed from dark mode comes out as dark ink on white paper.
 */

export const THEME_STORAGE_KEY = 'cms_theme_v2';

export type ThemeMode = 'light' | 'dark';

const readStored = (): ThemeMode => {
    try {
        return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
        return 'light';
    }
};

let preference: ThemeMode = typeof window === 'undefined' ? 'light' : readStored();
/** How many `<AppThemeScope>`s are mounted. The theme applies only while > 0. */
let scopes = 0;
/** How many mounted pages insist on light. */
let lightLocks = 0;
let printing = false;

const listeners = new Set<() => void>();

const isApplied = () => scopes > 0 && lightLocks === 0 && !printing && preference === 'dark';

/**
 * Put the document root in step with the store.
 *
 * `data-app-theme` doubles as the "we set `.dark`" marker: when it is absent
 * the class is somebody else's (the CMS) and is left alone.
 */
const apply = () => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    if (isApplied()) {
        root.classList.add('dark');
        root.setAttribute('data-app-theme', 'dark');
    } else if (root.hasAttribute('data-app-theme')) {
        root.classList.remove('dark');
        root.removeAttribute('data-app-theme');
    }
};

const emit = () => {
    apply();
    listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
};

const getSnapshot = () => preference;
const getServerSnapshot = (): ThemeMode => 'light';

/** Re-read storage — another tab, or the CMS, may have changed the choice. */
const refresh = () => {
    const stored = readStored();
    if (stored !== preference) preference = stored;
    emit();
};

export const setThemeMode = (mode: ThemeMode) => {
    preference = mode === 'dark' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_STORAGE_KEY, preference); } catch { /* private mode */ }
    emit();
};

if (typeof window !== 'undefined') {
    // Another tab changed the choice.
    window.addEventListener('storage', (event) => {
        if (event.key === THEME_STORAGE_KEY || event.key === null) refresh();
    });
    window.addEventListener('beforeprint', () => { printing = true; emit(); });
    window.addEventListener('afterprint', () => { printing = false; emit(); });
}

const getApplied = () => isApplied();
const getLocked = () => lightLocks > 0;

/**
 * Whether the dark theme is ON SCREEN right now — the saved choice AND inside a
 * signed-in area AND not on a page that insists on light. For things that take
 * a theme as a prop (the sonner toaster), where `useAppTheme().dark` would lie
 * on the public site.
 */
export function useThemeApplied(): boolean {
    return useSyncExternalStore(subscribe, getApplied, () => false);
}

/** True while a mounted page keeps the document light (a certificate). */
export function useThemeLocked(): boolean {
    return useSyncExternalStore(subscribe, getLocked, () => false);
}

/** The current choice and a way to change it. */
export function useAppTheme() {
    const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    const dark = mode === 'dark';

    return {
        mode,
        dark,
        setMode: setThemeMode,
        toggle: () => setThemeMode(dark ? 'light' : 'dark'),
    };
}

/**
 * Switch the saved theme ON for the subtree's lifetime.
 *
 * Layout effect, so a reload on a dark preference paints dark from the first
 * frame instead of flashing white for one.
 */
export function useAppThemeScope() {
    useLayoutEffect(() => {
        scopes += 1;
        // The CMS may have written a new choice since this module loaded.
        refresh();
        return () => {
            scopes = Math.max(0, scopes - 1);
            emit();
        };
    }, []);
}

/** Keep the document light while the calling page is mounted. */
export function useForceLightTheme() {
    useLayoutEffect(() => {
        lightLocks += 1;
        emit();
        return () => {
            lightLocks = Math.max(0, lightLocks - 1);
            emit();
        };
    }, []);
}
