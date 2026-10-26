import { useMemo } from 'react';
import { AppTheme, useAppTheme } from './AppTheme';
import { PALETTE } from './tokens';

// Older screens share token-based style sheets created once at module load.
// Resolve those neutral surface/text tokens per render without mutating the
// original sheet, remounting a screen, or changing document/brand artwork.
const TEXT_KEYS = new Set(['color', 'fg', 'text', 'textPrimary', 'textSecondary', 'textDisabled', 'textHint', 'textMuted', 'textFaint', 'textSoft', 'caption', 'solid']);
const SURFACE_KEYS = new Set(['backgroundColor', 'bg', 'background', 'surface', 'canvas', 'canvasAdmin', 'card', 'field', 'fieldBg', 'inputFill', 'inputFillAdmin', 'disabled', 'tint', 'soft']);
const BORDER_KEYS = new Set(['borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'border', 'borderStrong', 'pillBorder', 'divider', 'ring']);
const neutralText: Record<string, keyof typeof PALETTE> = {
  '#000': 'text', '#000000': 'text', '#111': 'text', '#111111': 'text', '#111827': 'text', '#0f172a': 'text', '#1f2937': 'text', '#1e293b': 'text',
  '#334155': 'textSoft', '#374151': 'textSoft', '#475569': 'textMuted', '#4b5563': 'textMuted', '#64748b': 'textMuted', '#6b7280': 'textMuted',
  '#94a3b8': 'textFaint', '#9ca3af': 'textFaint',
  '#0b1a45': 'text', '#1c2e68': 'textSoft', '#0e1f4d': 'text', '#1e3a8a': 'blueDark',
  '#17133c': 'text', '#1b1646': 'text', '#241c66': 'indigoDark',
  '#1955cf': 'blueDark',
};
const neutralFill: Record<string, keyof typeof PALETTE> = {
  '#fff': 'card', '#ffffff': 'card', '#fafafa': 'canvasAdmin', '#f4f7fb': 'canvas', '#f8fafc': 'fieldBg', '#f9fafb': 'fieldBg',
  '#f1f5f9': 'field', '#f3f4f6': 'field', '#eef2f6': 'divider', '#e5e7eb': 'border', '#e5eaf1': 'border', '#e2e8f0': 'disabled', '#cbd5e1': 'borderStrong',
  '#eff6ff': 'blueSoft', '#dbeafe': 'blueSoft', '#f0f7ff': 'blueTint', '#bfdbfe': 'blueSoft', '#dce8fd': 'blueSoft',
  '#fff3e0': 'amberSoft', '#fff7ed': 'amberSoft', '#fffbeb': 'amberSoft', '#e8f5e9': 'greenSoft', '#f0fdf4': 'greenSoft',
  '#f5f3ff': 'violetTint', '#faf5ff': 'violetTint', '#fef2f2': 'redSoft', '#fff1f2': 'redSoft',
  '#f3f6fb': 'fieldBg', '#f5f5fc': 'fieldBg', '#e8edf5': 'field', '#eef2ff': 'indigoSoft',
  '#f7faff': 'fieldBg', '#f6f8ff': 'fieldBg', '#f1f5fc': 'fieldBg', '#f0f4fa': 'fieldBg', '#f4f8ff': 'fieldBg',
  '#ebf1ff': 'blueSoft', '#edf2fa': 'field', '#edf2f8': 'field', '#f0f6ff': 'blueTint', '#eaf0fc': 'blueSoft', '#ecfdf5': 'greenSoft',
};
const tokenKeys = Object.keys(PALETTE) as (keyof typeof PALETTE)[];
function resolveValue<T>(value: T, theme: AppTheme, key = ''): T {
  if (!theme.isDark || value == null) return value;
  if (Array.isArray(value)) return value.map(item => resolveValue(item, theme, key)) as T;
  if (typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return value;
    return Object.fromEntries(Object.entries(value).map(([childKey, child]) =>
      [childKey, resolveValue(child, theme, childKey)])) as T;
  }
  if (typeof value !== 'string') return value;
  const normalized = value.toLowerCase();
  const textKey = TEXT_KEYS.has(key);
  const surfaceKey = SURFACE_KEYS.has(key);
  const borderKey = BORDER_KEYS.has(key);
  if (textKey && ['#fff', '#ffffff', 'white'].includes(normalized)) return value;
  const rgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(normalized);
  if (surfaceKey && rgba && [rgba[1], rgba[2], rgba[3]].every(channel => Number(channel) >= 235) && Number(rgba[4]) >= 0.6) {
    return `rgba(28,30,34,${rgba[4]})` as T;
  }
  if (textKey && neutralText[normalized]) return theme.palette[neutralText[normalized]] as T;
  if (textKey && normalized === PALETTE.indigo.toLowerCase()) return theme.palette.indigoDark as T;
  if (textKey && normalized === PALETTE.blue.toLowerCase()) return theme.palette.blueDark as T;
  if (textKey && normalized === PALETTE.violet.toLowerCase()) return theme.palette.violetDark as T;
  if (surfaceKey && neutralFill[normalized]) return theme.palette[neutralFill[normalized]] as T;
  if (borderKey && (neutralFill[normalized] || neutralText[normalized])) return theme.palette.border as T;
  if (textKey || surfaceKey || borderKey || /Soft$|Tint$|Dark$/.test(key) || key.startsWith('light')) {
    const token = tokenKeys.find(name => !['white', 'black'].includes(name) && PALETTE[name].toLowerCase() === normalized);
    // Solid brand fills retain their white foreground contrast. Only soft
    // surface tokens change; Dark variants are foregrounds, not button fills.
    if (token && (!surfaceKey || /Soft$|Tint$/.test(token))) return theme.palette[token] as T;
  }
  return value;
}

const cache = new WeakMap<object, WeakMap<AppTheme, unknown>>();
export function resolveLegacyAppearance<T>(value: T, theme: AppTheme): T {
  if (!theme.isDark || value == null || typeof value !== 'object') return value;
  let themes = cache.get(value);
  if (!themes) { themes = new WeakMap(); cache.set(value, themes); }
  if (!themes.has(theme)) themes.set(theme, resolveValue(value, theme));
  return themes.get(theme) as T;
}

export function useLegacyAppearance<T>(value: T): T {
  const theme = useAppTheme();
  return useMemo(() => resolveLegacyAppearance(value, theme), [value, theme]);
}
