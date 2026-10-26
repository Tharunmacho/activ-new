import { AppearancePicker } from '../../../ui/AppearancePicker';
import { AppTheme, useAppTheme, useThemeStyles } from '../../../ui/AppTheme';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Alert,
  Pressable,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import api from '../../../services/api';
import { clearSession } from '../../../services/session';
import { resolveMediaUrl } from '../../../config/api.config';
import { SPACE, SIZE, BrandBackdrop, GradientAvatar, GlassIconButton, PressableScale, premiumTone, prefersReducedMotion } from '../../../ui';

/**
 * ============================================================================
 * THE TIER ADMIN MENU — the website's admin sidebar, as a mobile drawer
 * ============================================================================
 *
 * The website gives every tier a navigation rail (tierConfig.TIER_NAV):
 *
 *   Dashboard · Approvals · Members · Hub (District & State only) · Settings
 *
 * A BLOCK admin has no Hub: nothing sits beneath a block, and a drill-down with
 * nothing to drill into reads as broken (website rule). There is deliberately
 * NO "Admins" entry on a tier rail — creating admins is the Super Admin's.
 *
 * Drawn as an absolutely-positioned overlay inside the tab navigator — never a
 * native <Modal> inside tabs (CLAUDE.md RULE 2, BadTokenException on API 36).
 * Premium: the indigo wave header with the admin's gradient avatar, glass
 * badges for tier and region, and gradient chips on the active item.
 */

export type AdminTier = 'block' | 'district' | 'state';
export type TierTab = 'Dashboard' | 'Approvals' | 'Members' | 'Hub' | 'Settings';

export const TIER_LABEL: Record<AdminTier, string> = { block: 'Block', district: 'District', state: 'State' };

/** The rail, per tier — exactly the website's. */
export const tierNav = (tier: AdminTier): { key: TierTab; label: string; icon: string; hint: string }[] => [
  { key: 'Dashboard', label: 'Dashboard', icon: 'space-dashboard', hint: 'Your region at a glance' },
  { key: 'Approvals', label: 'Approvals', icon: 'fact-check', hint: 'Applications waiting for your verdict' },
  { key: 'Members', label: 'Members', icon: 'groups', hint: 'Active, expiring, expired, awaiting payment' },
  ...(tier === 'block' ? [] : [{ key: 'Hub' as TierTab, label: 'Hub', icon: 'account-tree', hint: tier === 'state' ? 'Every district and block of your state' : 'Every block of your district' }]),
  { key: 'Settings', label: 'Settings', icon: 'manage-accounts', hint: 'Profile, password, sign out' },
];

const ADMIN = premiumTone('admin');

/* ------------------------------------------------------------------ context */

interface MenuCtx { open: () => void; close: () => void; isOpen: boolean; active: string; setActive: (k: string) => void }
const MenuContext = createContext<MenuCtx>({ open: () => {}, close: () => {}, isOpen: false, active: 'Dashboard', setActive: () => {} });

export function TierMenuProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [active, setActive] = useState('Dashboard');
  const value = useMemo(() => ({ open: () => setOpen(true), close: () => setOpen(false), isOpen, active, setActive }), [isOpen, active]);
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}

export const useTierMenu = () => useContext(MenuContext);

/** The ☰ button for a tier screen's (gradient) header. */
export function MenuButton({ style }: { style?: any }) {
  const { open } = useTierMenu();
  return <GlassIconButton icon="menu" onPress={open} style={style} accessibilityLabel="Open menu" />;
}

/* ------------------------------------------------------------------ sign out */

/** Sign out exactly like the website (POST /auth/logout, best effort) → admin sign-in. */
export const signOutAdmin = async (rootNavigation: any) => {
  try { await api.post('/auth/logout', {}); } catch { /* the local sign-out still happens */ }
  await clearSession();
  try {
    rootNavigation?.reset?.({ index: 0, routes: [{ name: 'AdminLogin' }] });
  } catch {
    rootNavigation?.navigate?.('AdminLogin');
  }
};

/* ------------------------------------------------------------------ drawer */

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 336);

export function TierMenuDrawer({
  tier, adminName, roleTitle, region, photo, rootNavigation, stackRoute,
}: {
  tier: AdminTier;
  adminName: string;
  roleTitle: string;
  region: string;
  photo?: string | null;
  /** The root stack navigation (for tab switches + sign out). */
  rootNavigation: any;
  /** This tier's stack route: BlockDashboard / DistrictDashboard / StateDashboard. */
  stackRoute: string;
}) {
  const { isOpen } = useTierMenu();
  if (!isOpen) return null;
  return (
    <DrawerPanel
      tier={tier}
      adminName={adminName}
      roleTitle={roleTitle}
      region={region}
      photo={photo}
      rootNavigation={rootNavigation}
      stackRoute={stackRoute}
    />
  );
}

function DrawerPanel({
  tier, adminName, roleTitle, region, photo, rootNavigation, stackRoute,
}: {
  tier: AdminTier; adminName: string; roleTitle: string; region: string; photo?: string | null;
  rootNavigation: any; stackRoute: string;
}) {
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { close, active } = useTierMenu();
  const slide = useRef(new Animated.Value(prefersReducedMotion() ? 1 : 0)).current;

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const anim = Animated.timing(slide, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    anim.start(({ finished }) => { if (!finished) slide.setValue(1); });
    return () => anim.stop();
  }, [slide]);

  // Android back closes the drawer before it reaches the tab.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
    return () => sub.remove();
  }, [close]);

  const go = (tab: TierTab) => {
    close();
    try { rootNavigation?.navigate?.(stackRoute, { screen: tab }); } catch { /* ignore */ }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Sign out of the admin panel?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { close(); signOutAdmin(rootNavigation); } },
    ]);
  };

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] });
  const photoUri = photo ? (String(photo).startsWith('/uploads') ? resolveMediaUrl(String(photo)) : String(photo)) : '';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: slide }]}>
        <Pressable style={s.scrim} onPress={close} accessibilityLabel="Close menu" />
      </Animated.View>
      <Animated.View style={[s.drawer, { width: DRAWER_WIDTH, paddingBottom: insets.bottom + SPACE.md, transform: [{ translateX }] }]}>
        <BrandBackdrop
          tone="admin"
          waveColor={PALETTE.canvasAdmin}
          waveHeight={44}
          contentStyle={{ paddingTop: insets.top + SPACE.lg, paddingHorizontal: SPACE.xl }}
        >
          <View style={s.headRow}>
            <GradientAvatar name={adminName || roleTitle || 'Admin'} uri={photoUri} size={64} tone="admin" status="online" />
            <GlassIconButton icon="close" onPress={close} accessibilityLabel="Close menu" />
          </View>
          <Text style={s.name} numberOfLines={2} maxFontSizeMultiplier={1.25}>{adminName || roleTitle}</Text>
          <View style={s.pills}>
            <View style={s.pill}>
              <Icon name="admin-panel-settings" size={13} color={PALETTE.white} />
              <Text style={s.pillText} numberOfLines={1}>{TIER_LABEL[tier]} Admin</Text>
            </View>
            {region ? (
              <View style={[s.pill, s.pillShrink]}>
                <Icon name="place" size={13} color={PALETTE.white} />
                <Text style={s.pillText} numberOfLines={1}>{region}</Text>
              </View>
            ) : null}
          </View>
        </BrandBackdrop>

        <ScrollView contentContainerStyle={s.list}>
          <Text style={s.section}>Admin panel</Text>
          {tierNav(tier).map((item) => {
            const on = active === item.key;
            return (
              <PressableScale
                key={item.key}
                onPress={() => go(item.key)}
                scaleTo={0.98}
                contentStyle={[s.item, on && s.itemOn]}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${item.label}, ${item.hint}`}
              >
                {on ? (
                  <LinearGradient colors={ADMIN.button} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.itemIcon}>
                    <Icon name={item.icon} size={20} color={PALETTE.white} />
                  </LinearGradient>
                ) : (
                  <View style={[s.itemIcon, s.itemIconOff]}>
                    <Icon name={item.icon} size={20} color={PALETTE.indigoDark} />
                  </View>
                )}
                <View style={s.itemText}>
                  <Text style={[s.itemLabel, on && { color: PALETTE.indigoDark }]}>{item.label}</Text>
                  <Text style={s.itemHint} numberOfLines={1}>{item.hint}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={on ? PALETTE.indigoDark : PALETTE.textFaint} />
              </PressableScale>
            );
          })}

          <View style={s.rule} />
          <Text style={s.section}>Appearance</Text>
          <AppearancePicker tone="admin" />
          <View style={s.rule} />
          <PressableScale onPress={confirmSignOut} scaleTo={0.98} contentStyle={s.item} accessibilityRole="button" accessibilityLabel="Sign out">
            <View style={[s.itemIcon, { backgroundColor: PALETTE.redSoft }]}>
              <Icon name="logout" size={20} color={PALETTE.red} />
            </View>
            <View style={s.itemText}>
              <Text style={[s.itemLabel, { color: PALETTE.dangerText }]}>Sign out</Text>
              <Text style={s.itemHint} numberOfLines={1}>End the admin session on this phone</Text>
            </View>
          </PressableScale>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const makeStyles = ({ palette: PALETTE, type: TYPE, brand: BRAND }: AppTheme) => StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,10,40,0.55)' },
  drawer: {
    position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: PALETTE.canvasAdmin,
    borderTopRightRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden', elevation: 18,
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 8, height: 0 }, shadowOpacity: 0.3, shadowRadius: 24,
  },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4, color: PALETTE.white, marginTop: SPACE.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: SPACE.md - 2, paddingVertical: 5,
    borderRadius: 999, backgroundColor: BRAND.glassStrong, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  pillShrink: { flexShrink: 1 },
  pillText: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.6, color: PALETTE.white, flexShrink: 1, textTransform: 'uppercase' },
  list: { paddingHorizontal: SPACE.md, paddingBottom: SPACE.lg },
  section: { ...TYPE.eyebrow, color: PALETTE.textFaint, marginHorizontal: SPACE.sm, marginTop: SPACE.xs, marginBottom: SPACE.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md, borderRadius: 18, marginBottom: SPACE.xs, minHeight: SIZE.row + SPACE.xs },
  itemOn: {
    backgroundColor: PALETTE.card, borderWidth: 1, borderColor: 'rgba(84,64,212,0.16)',
    shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 2,
  },
  itemIcon: { width: SIZE.iconChip + 2, height: SIZE.iconChip + 2, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  itemIconOff: { backgroundColor: PALETTE.indigoSoft },
  itemText: { flex: 1, minWidth: 0 },
  itemLabel: { ...TYPE.subheading, fontWeight: '700' },
  itemHint: { ...TYPE.caption, marginTop: 1 },
  rule: { height: StyleSheet.hairlineWidth * 2, backgroundColor: PALETTE.divider, marginVertical: SPACE.md, marginHorizontal: SPACE.sm },
});
