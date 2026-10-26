import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import { AppearancePicker } from '../../../ui/AppearancePicker';
import { AppTheme, useAppTheme, useThemeStyles } from '../../../ui/AppTheme';
import React, { useEffect, useRef } from 'react';
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
import { resolveMediaUrl } from '../../../config/api.config';
import { useAuthStore } from '../../../stores/exampleStore';
import { SPACE, SIZE, BrandBackdrop, GradientAvatar, GlassIconButton, PressableScale, premiumTone, prefersReducedMotion } from '../../../ui';
import { signOutAdmin, useTierMenu } from '../shared/TierMenu';
import { useSuperAdminData } from './context/SuperAdminContext';
import { SUPER_MENU_SECTIONS } from './SuperMenuScreen';

/**
 * ============================================================================
 * THE SUPER ADMIN SIDE MENU — the tier admins' ☰ drawer, for the Super Admin
 * ============================================================================
 *
 * Same drawer as the Block / District / State dashboards (TierMenu): the same
 * open/close context, the same indigo header, the same sign-out. Its list is
 * the "More" tab's — SUPER_MENU_SECTIONS — so the two can never disagree about
 * what the Super Admin can open.
 *
 * An absolutely-positioned overlay inside the tab navigator, never a native
 * <Modal> inside tabs (CLAUDE.md RULE 2).
 */

/** The Super Admin tabs. Everything else on the menu is a stack screen. */
const TABS = new Set(['Hub', 'Admins', 'Events', 'Settings', 'More']);
/** Which menu entry lights up for the tab on screen. */
const ACTIVE_KEY: Record<string, string> = { Hub: 'hub', Admins: 'admins', Events: 'events', Settings: 'settings' };

const ADMIN = premiumTone('admin');
const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.86, 336);

export function SuperMenuDrawer({ rootNavigation }: { rootNavigation: any }) {
  const { isOpen } = useTierMenu();
  if (!isOpen) return null;
  return <DrawerPanel rootNavigation={rootNavigation} />;
}

function DrawerPanel({ rootNavigation }: { rootNavigation: any }) {
  const makeStyles = useLegacyAppearance(legacyAppearance_makeStyles);
  const ADMIN = useLegacyAppearance(legacyAppearance_ADMIN);
  const { palette: PALETTE } = useAppTheme();
  const s = useThemeStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { close, active } = useTierMenu();
  const { logout } = useAuthStore();
  const { adminName, adminEmail, adminProfilePhoto } = (useSuperAdminData() as any) || {};
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

  /*
   * The menu entries were written for a screen INSIDE the tabs, where
   * navigate('Hub') reaches a sibling tab. From here — the tab navigator's own
   * parent — a tab has to be addressed through the Super Admin stack route.
   */
  const nav = {
    navigate: (name: string, params?: any) => {
      try {
        if (TABS.has(name)) rootNavigation?.navigate?.('SuperAdminDashboard', { screen: name, params });
        else rootNavigation?.navigate?.(name, params);
      } catch { /* a missing route must not close the app */ }
    },
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out', 'Sign out of the Super Admin account on this phone?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          close();
          try { await logout(); } catch { /* storage */ }
          signOutAdmin(rootNavigation);
        },
      },
    ]);
  };

  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [-DRAWER_WIDTH, 0] });
  const activeKey = ACTIVE_KEY[active] || '';
  const name = String(adminName || 'Super Admin');

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
            <GradientAvatar name={name} uri={adminProfilePhoto ? resolveMediaUrl(String(adminProfilePhoto)) : ''} size={64} tone="admin" status="online" />
            <GlassIconButton icon="close" onPress={close} accessibilityLabel="Close menu" />
          </View>
          <Text style={s.name} numberOfLines={2} maxFontSizeMultiplier={1.25}>{name}</Text>
          {adminEmail ? <Text style={s.email} numberOfLines={1}>{String(adminEmail)}</Text> : null}
          <View style={s.pills}>
            <View style={s.pill}>
              <Icon name="admin-panel-settings" size={13} color={PALETTE.white} />
              <Text style={s.pillText} numberOfLines={1}>Super Admin</Text>
            </View>
            <View style={s.pill}>
              <Icon name="public" size={13} color={PALETTE.white} />
              <Text style={s.pillText} numberOfLines={1}>All India</Text>
            </View>
          </View>
        </BrandBackdrop>

        <ScrollView contentContainerStyle={s.list}>
          {(SUPER_MENU_SECTIONS || []).map((sec) => (
            <View key={sec.title}>
              <Text style={s.section}>{sec.title}</Text>
              {(sec.items || []).map((item) => {
                const on = item.key === activeKey;
                return (
                  <PressableScale
                    key={item.key}
                    onPress={() => { close(); item.go(nav); }}
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
            </View>
          ))}

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
              <Text style={s.itemHint} numberOfLines={1}>End the Super Admin session on this phone</Text>
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
  email: { ...TYPE.caption, color: 'rgba(255,255,255,0.78)', marginTop: 2 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: SPACE.md - 2, paddingVertical: 5,
    borderRadius: 999, backgroundColor: BRAND.glassStrong, borderWidth: 1, borderColor: BRAND.glassBorder,
  },
  pillText: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.6, color: PALETTE.white, flexShrink: 1, textTransform: 'uppercase' },
  list: { paddingHorizontal: SPACE.md, paddingBottom: SPACE.lg },
  section: { ...TYPE.eyebrow, color: PALETTE.textFaint, marginHorizontal: SPACE.sm, marginTop: SPACE.md, marginBottom: SPACE.sm },
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

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_makeStyles = makeStyles;
const legacyAppearance_ADMIN = ADMIN;
