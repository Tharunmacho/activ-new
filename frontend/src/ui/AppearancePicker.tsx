import React from 'react';
import { Text, View } from 'react-native';
import { useAppTheme, ThemePreference } from './AppTheme';
import { SegmentedTabs } from './components';
import { SPACE, Tone } from './tokens';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function AppearancePicker({ tone = 'member' }: { tone?: Tone }) {
  const { preference, setPreference, isDark, type, palette, storageError } = useAppTheme();
  return (
    <View style={{ gap: SPACE.sm }}>
      <SegmentedTabs options={OPTIONS} value={preference} onChange={setPreference} tone={tone} />
      <Text style={type.caption}>
        {preference === 'system' ? `Follows your phone’s appearance. Currently ${isDark ? 'dark' : 'light'}.` : `${isDark ? 'Dark' : 'Light'} appearance on this phone.`}
      </Text>
      {storageError ? <Text accessibilityRole="alert" style={[type.caption, { color: palette.dangerText }]}>{storageError}</Text> : null}
    </View>
  );
}
