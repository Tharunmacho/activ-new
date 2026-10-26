import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTE, TYPE, Tone, toneOf, statusTone } from './tokens';
import { BRAND, premiumTone } from './premium/theme';

export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_STORAGE_KEY = '@activ/appearance';
export type ThemePalette = typeof PALETTE;

export const DARK_PALETTE: ThemePalette = {
  ...PALETTE,
  canvas: '#111214', canvasAdmin: '#111214', card: '#1C1E22', surface: '#1C1E22', background: '#111214',
  border: '#34373D', borderStrong: '#51565F', divider: '#303339', field: '#282B30', fieldBg: '#24272C', disabled: '#3D424A',
  text: '#F1F5FB', textSoft: '#D4DFEE', textMuted: '#A8B8CE', textFaint: '#93A5BD', overlay: 'rgba(0,0,0,0.65)',
  blueDark: '#93C5FD', blueSoft: '#172F51', blueTint: '#16243B', primaryDark: '#93C5FD', primarySoft: '#172F51',
  indigoDark: '#C7C4FF', indigoSoft: '#2B2850', indigoTint: '#211F39',
  violetDark: '#D1B5FF', violetSoft: '#33244F', violetTint: '#251D37', violetBorder: '#584174',
  greenDark: '#6EE7B7', greenSoft: '#113D34', amberDark: '#FCD34D', amberSoft: '#473416',
  redDark: '#FCA5A5', redSoft: '#4C242D', skyDark: '#7DD3FC', skySoft: '#173B4E', goldDark: '#E7C766', goldSoft: '#3F351D',
  successText: '#6EE7B7', successSoft: '#113D34', warningText: '#FCD34D', warningSoft: '#473416',
  dangerText: '#FCA5A5', dangerSoft: '#4C242D', infoText: '#7DD3FC', infoSoft: '#173B4E',
};

function makeTokens(isDark: boolean) {
  const palette = isDark ? DARK_PALETTE : PALETTE;
  const type = {
    ...TYPE,
    display: { ...TYPE.display, color: palette.text }, title: { ...TYPE.title, color: palette.text },
    heading: { ...TYPE.heading, color: palette.text }, subheading: { ...TYPE.subheading, color: palette.text },
    body: { ...TYPE.body, color: palette.textSoft }, bodyStrong: { ...TYPE.bodyStrong, color: palette.text },
    label: { ...TYPE.label, color: palette.textSoft }, caption: { ...TYPE.caption, color: palette.textMuted },
    small: { ...TYPE.small, color: palette.textMuted }, eyebrow: { ...TYPE.eyebrow, color: palette.textMuted },
    number: { ...TYPE.number, color: palette.text },
  };
  const themedTone = (tone: Tone = 'member') => {
    const base = toneOf(tone);
    const key = tone === 'business' ? 'violet' : tone === 'admin' ? 'indigo' : 'blue';
    return { ...base, ...(isDark && tone === 'admin' ? { gradient: ['#111214', '#202329', '#30343C'] } : {}), canvas: tone === 'admin' ? palette.canvasAdmin : palette.canvas,
      accentDark: palette[`${key}Dark`], accentSoft: palette[`${key}Soft`], accentTint: palette[`${key}Tint`] };
  };
  return { isDark, palette, type, toneOf: themedTone,
    brand: isDark ? { ...BRAND, inputFill: palette.fieldBg, inputFillAdmin: palette.fieldBg, errorFill: palette.dangerSoft } : BRAND,
    premiumTone: (tone: Tone = 'member') => {
      const base = premiumTone(tone);
      if (!isDark) return base;
      const themed = themedTone(tone);
      return { ...base, ...(tone === 'admin' ? { header: ['#111214', '#1B1D22', '#25282E', '#30343C'], top: '#111214' } : {}), accentDark: themed.accentDark, accentSoft: themed.accentSoft,
        accentSoft2: themed.accentTint, inputFill: palette.fieldBg };
    },
    statusTone: (status?: string | null) => {
      const base = statusTone(status);
      if (!isDark) return base;
      const match = Object.keys(PALETTE).find(key => PALETTE[key as keyof ThemePalette] === base.bg);
      const foreground = Object.keys(PALETTE).find(key => PALETTE[key as keyof ThemePalette] === base.fg);
      return { bg: match ? palette[match as keyof ThemePalette] : palette.field,
        fg: foreground ? palette[foreground as keyof ThemePalette] : palette.textSoft };
    },
  };
}

const LIGHT = makeTokens(false);
const DARK = makeTokens(true);
export type AppTheme = ReturnType<typeof makeTokens> & {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  ready: boolean;
  storageError: string | null;
};
const ThemeContext = createContext<AppTheme>({ ...LIGHT, preference: 'light', setPreference: () => {}, ready: true, storageError: null });
const validPreference = (value: unknown): value is ThemePreference => value === 'system' || value === 'light' || value === 'dark';

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  // Start in the familiar light appearance. Following the phone is opt-in;
  // a device switching to dark at night must not change the app unexpectedly.
  const [preference, updatePreference] = useState<ThemePreference>('light');
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const revision = useRef(0);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    const initialRevision = revision.current;
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(value => {
      if (active && revision.current === initialRevision && validPreference(value)) updatePreference(value);
    }).catch(() => {
      if (active) setStorageError('Your saved appearance could not be loaded.');
    }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  const setPreference = useCallback((value: ThemePreference) => {
    if (!validPreference(value)) return;
    const change = ++revision.current;
    updatePreference(value);
    setStorageError(null);
    // Serialize rapid changes so an older storage write cannot win on restart.
    writes.current = writes.current.then(() => AsyncStorage.setItem(THEME_STORAGE_KEY, value)).catch(() => {
      if (revision.current === change) setStorageError('Appearance changed, but could not be saved. Please try again.');
    });
  }, []);
  const isDark = preference === 'dark' || (preference === 'system' && systemScheme === 'dark');
  const value = useMemo<AppTheme>(() => ({ ...(isDark ? DARK : LIGHT), preference, setPreference, ready, storageError }),
    [isDark, preference, setPreference, ready, storageError]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);

const styleCache = new WeakMap<Function, WeakMap<AppTheme, unknown>>();
/** Define the factory outside the component; styles update with the palette. */
export function useThemeStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => {
    let cache = styleCache.get(factory);
    if (!cache) { cache = new WeakMap(); styleCache.set(factory, cache); }
    if (!cache.has(theme)) cache.set(theme, factory(theme));
    return cache.get(theme) as T;
  }, [factory, theme]);
}
