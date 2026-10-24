import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PressableScale, SiteArt, type SiteArtKind } from '../../ui';

/** The original compact carousel size, with room for enlarged system text. */
export function exploreCardWidth(windowWidth: number, fontScale = 1): number {
  const viewport = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 393;
  const scale = Number.isFinite(fontScale) && fontScale > 1 ? fontScale : 1;
  return Math.round(Math.min(Math.max(132, Math.min(168, viewport / 3)) * Math.min(scale, 1.8), Math.max(120, viewport - 32)));
}

export function ExploreGradientCard({ title, description, colors, art, icon, caption, width, accessibilityLabel, onPress }: {
  title: string; description: string; colors: string[]; art?: SiteArtKind; icon?: string;
  caption?: string; width: number; accessibilityLabel?: string; onPress: () => void;
}) {
  return <PressableScale onPress={onPress} style={{ width, flexShrink: 0 }} scaleTo={0.95}
    contentStyle={[s.shadow, { shadowColor: colors[0], backgroundColor: colors[0] }]}
    accessibilityRole="button" accessibilityLabel={accessibilityLabel || `${title}. ${description}`}>
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
      <View pointerEvents="none" style={s.orb} />
      <View style={s.head}>
        {art ? <SiteArt kind={art} size={40} /> : <View style={s.icon}><Icon name={icon || 'explore'} size={32} color="#FFFFFF" /></View>}
        <Icon name="arrow-outward" size={16} color="#FFFFFFCC" />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.description}>{description}</Text>
      {!!caption && <Text style={s.caption}>{caption}</Text>}
    </LinearGradient>
  </PressableScale>;
}

const s = StyleSheet.create({
  shadow: { flex: 1, borderRadius: 20, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 },
  card: { flex: 1, minHeight: 142, borderRadius: 20, padding: 12, overflow: 'hidden' },
  orb: { position: 'absolute', width: 110, height: 110, borderRadius: 55, right: -40, bottom: -50, backgroundColor: '#FFFFFF24' },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  icon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#FFFFFF', marginTop: 12 },
  description: { fontSize: 11, lineHeight: 15, fontWeight: '500', color: '#FFFFFF', marginTop: 2 },
  caption: { fontSize: 11, lineHeight: 16, fontWeight: '600', color: '#FFFFFF', paddingTop: 10, marginTop: 'auto' },
});
