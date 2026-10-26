import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import { useAppTheme } from '../../../ui/AppTheme';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { TYPE, PressableScale, useReduceMotion } from '../../../ui';

type Props = { name: string; memberId: string; since: string; active: boolean; onPress: () => void };

/** Lifetime Membership in the same warm gold palette as the website. */
export default function PlatinumMembershipCard({ name, memberId, since, active, onPress }: Props) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const reduceMotion = useReduceMotion();
  const shine = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    shine.setValue(0);
    if (reduceMotion) return;
    const animation = Animated.timing(shine, { toValue: 1, delay: 500, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [reduceMotion, shine]);
  return <View style={s.stage}>
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`Lifetime Membership for ${name}. Member ID ${memberId || 'not assigned'}. ${active ? 'Active' : 'Pending'}. Open membership details.`}>
      <LinearGradient colors={['#c8a04a', '#e9cb80', '#f8e6b2', '#e7c776', '#ccaa58']} locations={[0, .24, .47, .72, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
        <View pointerEvents="none" accessible={false} style={s.contours}>{[0, 1, 2, 3, 4, 5].map(i => <View key={i} style={[s.ring, { top: i * 12, left: i * 12, right: i * 12, bottom: i * 12 }]} />)}</View>
        {!reduceMotion && <Animated.View pointerEvents="none" accessible={false} style={[s.reflection, { transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-220, 600] }) }, { rotate: '-25deg' }] }]}><LinearGradient colors={['#ffffff00', '#ffffff80', '#ffffff00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} /></Animated.View>}
        <View style={s.top}><View><Text style={s.wordmark}>ACTIV</Text><Text style={s.wordmarkSub}>MEMBERSHIP</Text></View><View style={s.seal}><Icon name="workspace-premium" size={25} color="#795617" /></View></View>
        <Text style={s.title}>Lifetime</Text><Text style={s.edition}>Membership</Text>
        <View style={s.identity}><Text style={s.label}>MEMBER ID</Text><Text style={s.id}>{memberId || 'Awaiting assignment'}</Text></View>
        <View style={s.bottom}><View style={s.holder}><Text style={s.name}>{name}</Text><Text style={s.since}>{since ? `Member since ${since}` : 'Lifetime member'}</Text></View><View style={[s.status, !active && s.pending]}><Icon name="verified" size={12} color={active ? '#235b47' : '#79541b'} /><Text style={[s.statusText, !active && { color: '#79541b' }]}>{active ? 'Active' : 'Pending'}</Text></View></View>
      </LinearGradient>
      <View style={s.footer}><View style={s.footerTitle}><Icon name="all-inclusive" size={18} color="#795617" /><Text style={s.footerText}>Your membership. For a lifetime.</Text></View><Icon name="north-east" size={16} color="#795617" /></View>
    </PressableScale>
  </View>;
}

export function PlatinumMemberShortcuts({ onBusiness, onDocuments, onReceipt }: { onBusiness: () => void; onDocuments: () => void; onReceipt: () => void }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const { palette, isDark } = useAppTheme();
  const ink = isDark ? '#F0D38F' : '#876018';
  return <View style={s.shortcuts}><Text style={[s.sectionLabel, { color: palette.textMuted }]}>YOUR MEMBER SPACE</Text><View style={s.shortcutRow}>{[
    { label: 'Business', icon: 'business-center', onPress: onBusiness },
    { label: 'Documents', icon: 'description', onPress: onDocuments },
    { label: 'Receipt', icon: 'receipt-long', onPress: onReceipt },
  ].map(action => <PressableScale key={action.label} onPress={action.onPress} style={s.shortcutFlex} accessibilityRole="button" accessibilityLabel={`Open ${action.label.toLowerCase()}`}><LinearGradient colors={isDark ? ['#29261e', '#353024'] : ['#fff9e9', '#f7ebc9']} style={[s.shortcut, isDark && { borderColor: '#625436' }]}><Icon name={action.icon} size={23} color={ink} /><Text style={[s.shortcutText, { color: ink }]}>{action.label}</Text><Icon name="north-east" size={14} color={ink} style={s.shortcutArrow} /></LinearGradient></PressableScale>)}</View></View>;
}

const s = StyleSheet.create({
  stage: { borderRadius: 24, backgroundColor: '#fff5d9', shadowColor: '#795617', shadowOpacity: .2, shadowOffset: { width: 0, height: 12 }, shadowRadius: 20, elevation: 7 },
  card: { borderRadius: 23, borderWidth: 1, borderColor: '#d5b365', padding: 23, overflow: 'hidden' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  wordmark: { ...TYPE.heading, fontSize: 27, lineHeight: 31, fontWeight: '800', fontStyle: 'italic', letterSpacing: -1.2, color: '#3e2c0e' },
  wordmarkSub: { ...TYPE.caption, fontSize: 7, letterSpacing: 2.3, color: '#674c1b', lineHeight: 12 },
  seal: { height: 40, width: 40, borderRadius: 20, borderWidth: 1, borderColor: '#ffffffcc', backgroundColor: '#fff1be80', alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPE.heading, fontSize: 32, lineHeight: 39, fontWeight: '600', letterSpacing: -0.8, color: '#3e2c0e', marginTop: 19 },
  edition: { ...TYPE.caption, fontSize: 16, lineHeight: 22, letterSpacing: 0.2, color: '#674c1b', marginTop: 2 },
  identity: { marginTop: 23 },
  label: { ...TYPE.caption, fontSize: 9, letterSpacing: 1.6, color: '#674c1b' },
  id: { ...TYPE.body, fontSize: 15, fontWeight: '600', letterSpacing: 1, color: '#3e2c0e', marginTop: 4 },
  bottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#946a283b' },
  holder: { flex: 1, minWidth: 130 },
  name: { ...TYPE.body, fontSize: 13, fontWeight: '600', color: '#3e2c0e' },
  since: { ...TYPE.caption, fontSize: 10, color: '#674c1b', marginTop: 3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, backgroundColor: '#effff6b0' },
  pending: { backgroundColor: '#fff4deb0' },
  statusText: { ...TYPE.caption, fontSize: 10, color: '#235b47' },
  contours: { position: 'absolute', width: 260, height: 340, right: -135, top: -55, transform: [{ rotate: '-25deg' }] },
  ring: { position: 'absolute', borderWidth: 1, borderColor: '#8f631d33', borderRadius: 120 },
  reflection: { position: 'absolute', top: -100, bottom: -100, width: 100 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 19, paddingVertical: 14 },
  footerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { ...TYPE.caption, fontSize: 10, color: '#674c1b', flex: 1 },
  shortcuts: { marginTop: 23 },
  sectionLabel: { ...TYPE.caption, fontSize: 10, letterSpacing: 1.8, color: '#71634e', marginBottom: 12 },
  shortcutRow: { flexDirection: 'row', alignItems: 'stretch', gap: 9 },
  shortcutFlex: { flex: 1, minWidth: 0 },
  shortcut: { borderRadius: 17, padding: 13, minHeight: 114, flex: 1, borderWidth: 1, borderColor: '#e4d5b6' },
  shortcutText: { ...TYPE.caption, fontSize: 11, fontWeight: '500', color: '#3b3020', marginTop: 12 },
  shortcutArrow: { alignSelf: 'flex-end', marginTop: 8 },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
