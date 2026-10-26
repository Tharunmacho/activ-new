import React from 'react';
import { Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LiftCard, SPACE } from '../../ui';
import { useAppTheme } from '../../ui/AppTheme';

/** A company-level count from the API; missing data is never presented as zero. */
export function BusinessTrustCount({ count }: { count: number | null }) {
  const { palette: PALETTE, type: TYPE } = useAppTheme();
  const value = count === null ? 'Count unavailable' : `${count} ${count === 1 ? 'member' : 'members'}`;
  return (
    <LiftCard tone="business" style={{ marginHorizontal: SPACE.lg, marginBottom: SPACE.md }}>
      <View accessible accessibilityLabel={`Trusted by: ${value}`} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
        <Icon name="verified-user" size={28} color={PALETTE.violet} />
        <View style={{ flex: 1 }}>
          <Text style={TYPE.label} maxFontSizeMultiplier={1.3}>Trusted by</Text>
          <Text style={TYPE.title} maxFontSizeMultiplier={1.3}>{value}</Text>
        </View>
      </View>
    </LiftCard>
  );
}
