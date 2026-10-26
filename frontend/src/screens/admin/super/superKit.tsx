import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert, Linking, Platform } from 'react-native';
import { PALETTE, SPACE, SIZE, TYPE, ConsolePill, ConsoleTabs } from '../../../ui';
import api from '../../../services/api';

/**
 * Small pieces shared by the Super Admin stack screens (module-level only).
 * Everything else comes from the design kit in `src/ui` with tone 'admin'.
 */

/** Ask before a destructive / outward action. Resolves true when confirmed. */
export const confirm = (title: string, message: string, ok = 'Confirm', destructive = false) =>
  new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });

export const openUrl = async (url?: string) => {
  try {
    if (url) await Linking.openURL(url);
  } catch (err) {
    Alert.alert('Could not open', 'No app on this phone can open that link.');
  }
};

/** tel: / WhatsApp for a phone number (Indian numbers default to +91). */
export const callNumber = (phone?: string) => {
  const d = String(phone || '').replace(/\D/g, '');
  if (d) openUrl(`tel:${d}`);
};
export const whatsappNumber = (phone?: string, text = '') => {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) d = `91${d}`;
  if (d) openUrl(`https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`);
};

/**
 * A pick-one row (financial years, filters) — the console's gradient pills,
 * scrolling sideways when the options outgrow a 360dp phone. Carries the
 * screen gutter itself; inside a padded card pull it out with a negative
 * horizontal margin.
 */
export function ChipRow<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  return <ConsoleTabs<T> scrollable options={options || []} value={value} onChange={onChange} style={s.chips} />;
}

/** A labelled on/off switch row inside a card. */
export function ToggleRow({ label, hint, value, onChange, disabled, last }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; last?: boolean;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={[s.toggle, !last && s.divider]}>
      <View style={s.toggleText}>
        <Text style={s.toggleLabel}>{label}</Text>
        {hint ? <Text style={s.toggleHint}>{hint}</Text> : null}
      </View>
      <Switch value={!!value} onValueChange={onChange} disabled={disabled} accessibilityLabel={label}
        trackColor={{ false: PALETTE.borderStrong, true: PALETTE.indigo }}
        thumbColor={Platform.OS === 'android' ? PALETTE.white : undefined}
        ios_backgroundColor={PALETTE.borderStrong} />
    </View>
  );
}

/** Small icon + text action (inside cards / rows) — the console's outlined pill. */
export function MiniAction({ icon, label, onPress, color = PALETTE.indigo, disabled }: {
  icon: string; label: string; onPress?: () => void; color?: string; disabled?: boolean;
}) {
  return <ConsolePill icon={icon} label={label} onPress={onPress} color={color} disabled={disabled} />;
}

export const initials = (name?: string | null) => {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  return p.length === 1 ? (p[0] || '').charAt(0).toUpperCase() : `${(p[0] || '').charAt(0)}${(p[p.length - 1] || '').charAt(0)}`.toUpperCase();
};

export const place = (...parts: (string | undefined | null)[]) => parts.filter((x) => !!(x || '').trim()).join(', ');

const s = StyleSheet.create({
  chips: { marginTop: SPACE.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACE.md, minHeight: SIZE.row },
  toggleText: { flex: 1, minWidth: 0, paddingRight: SPACE.md },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  toggleLabel: { ...TYPE.subheading },
  toggleHint: { ...TYPE.caption, lineHeight: 17, marginTop: SPACE.xxs },
});

/* ------------------------------------------------------------ regions */

/**
 * EVERY region any admin account names — `GET /regions/tree?include=all`.
 * Content targeting reads this scope, never the pruned registration tree
 * (CLAUDE.md "That pruning belongs to registration and nowhere else"): a
 * state with only a state admin is still a real audience.
 */
let treeCache: { at: number; states: any[] } | null = null;
export function useRegionTreeAll() {
  const [states, setStates] = useState<any[]>(treeCache?.states || []);
  useEffect(() => {
    let alive = true;
    if (treeCache && Date.now() - treeCache.at < 120000) return undefined;
    api.get('/regions/tree', { params: { include: 'all' } })
      .then((res) => {
        const payload = res?.data?.data || res?.data || {};
        const list = Array.isArray(payload?.states) ? payload.states : [];
        treeCache = { at: Date.now(), states: list };
        if (alive) setStates(list);
      })
      .catch(() => null);
    return () => { alive = false; };
  }, []);
  return states;
}

const eqi = (a?: string, b?: string) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** Names for one level of the tree, below the chosen parents. */
export function useRegionNames(states: any[], state?: string, district?: string) {
  return useMemo(() => {
    const list = Array.isArray(states) ? states : [];
    const st = list.find((x) => eqi(x?.name, state));
    const ds = Array.isArray(st?.districts) ? st.districts : [];
    const dt = ds.find((x: any) => eqi(x?.name, district));
    return {
      states: list.map((x) => String(x?.name || '')).filter(Boolean),
      districts: ds.map((x: any) => String(x?.name || '')).filter(Boolean),
      blocks: (Array.isArray(dt?.blocks) ? dt.blocks : []).map((x: any) => String(x?.name || '')).filter(Boolean),
    };
  }, [states, state, district]);
}

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
