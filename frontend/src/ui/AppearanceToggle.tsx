import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from './AppTheme';

/** An explicit light/dark choice, available without opening Settings. */
export function AppearanceToggle({ glass = false }: { glass?: boolean }) {
  const { isDark, setPreference, palette, storageError } = useAppTheme();
  return <View>
    <View accessibilityLabel="App appearance" style={{ flexDirection: 'row', borderRadius: 24,
      padding: 3, borderWidth: 1, borderColor: glass ? 'rgba(255,255,255,0.25)' : palette.border,
      backgroundColor: glass ? 'rgba(0,0,0,0.18)' : palette.field }}>
      {([{ value: 'light', icon: 'light-mode' }, { value: 'dark', icon: 'dark-mode' }] as const).map(option => {
        const selected = option.value === (isDark ? 'dark' : 'light');
        return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }}
          accessibilityLabel={`Use ${option.value} appearance`} onPress={() => setPreference(option.value)}
          style={({ pressed }) => ({ width: 44, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
            opacity: pressed ? 0.75 : 1, backgroundColor: selected ? (glass ? '#FFFFFF' : palette.card) : 'transparent' })}>
          <Icon name={option.icon} size={21} color={selected ? (glass ? '#1D4ED8' : palette.primaryDark) : (glass ? '#FFFFFF' : palette.textMuted)} />
        </Pressable>;
      })}
    </View>
    {storageError ? <Text accessibilityRole="alert" style={{ maxWidth: 200, color: glass ? '#FFFFFF' : palette.dangerText, fontSize: 11 }}>{storageError}</Text> : null}
  </View>;
}
