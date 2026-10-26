import React from 'react';
import Renderer from 'react-test-renderer';
import { StyleSheet, View, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppTheme, AppThemeProvider, DARK_PALETTE, THEME_STORAGE_KEY, useAppTheme } from '../src/ui/AppTheme';
import { AppearancePicker } from '../src/ui/AppearancePicker';
import { Card } from '../src/ui/components';
import { PALETTE } from '../src/ui/tokens';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({ __esModule: true, default: jest.fn(() => 'light') }));

let screen: Renderer.ReactTestRenderer | undefined;
let theme: AppTheme;
function Probe() {
  theme = useAppTheme();
  return <><AppearancePicker tone="business" /><Card><View testID="card-child" /></Card></>;
}
async function render() {
  await Renderer.act(async () => { screen = Renderer.create(<AppThemeProvider><Probe /></AppThemeProvider>); });
}
const pick = async (label: string) => {
  const button = screen!.root.findAll(node => node.props.accessibilityRole === 'radio' && node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  await Renderer.act(async () => { button.props.onPress(); });
};

beforeEach(async () => {
  jest.clearAllMocks();
  (useColorScheme as jest.Mock).mockReturnValue('light');
  await AsyncStorage.clear();
});
afterEach(async () => {
  await Renderer.act(async () => screen?.unmount());
  screen = undefined;
});

test('appearance controls update cards immediately and restore the preference after restart', async () => {
  await render();
  expect(theme.palette.card).toBe(PALETTE.card);
  await pick('Dark');
  expect(theme.isDark).toBe(true);
  expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(THEME_STORAGE_KEY, 'dark');
  const darkCard = screen!.root.findAllByType(View).some(node => StyleSheet.flatten(node.props.style)?.backgroundColor === DARK_PALETTE.card);
  expect(darkCard).toBe(true);
  await Renderer.act(async () => screen!.unmount());
  await render();
  expect(theme.preference).toBe('dark');
  expect(theme.palette.text).toBe(DARK_PALETTE.text);
  await pick('Light');
  expect(theme.isDark).toBe(false);
  expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
});

test('system follows phone changes while an explicit preference stays fixed', async () => {
  await render();
  (useColorScheme as jest.Mock).mockReturnValue('dark');
  await Renderer.act(async () => { screen!.update(<AppThemeProvider><Probe /></AppThemeProvider>); });
  expect(theme.isDark).toBe(true);
  await pick('Light');
  expect(theme.isDark).toBe(false);
  await pick('System');
  expect(theme.isDark).toBe(true);
  expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
});

test('an in-flight saved preference cannot replace a more recent user choice', async () => {
  let finishRead!: (value: string) => void;
  (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
  await render();
  expect(theme.ready).toBe(false);
  await pick('Dark');
  await Renderer.act(async () => { finishRead('light'); });
  expect(theme.ready).toBe(true);
  expect(theme.preference).toBe('dark');
});

test('failed storage writes keep the selected appearance and expose a retry message', async () => {
  await render();
  (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage unavailable'));
  await pick('Dark');
  expect(theme.isDark).toBe(true);
  expect(theme.storageError).toMatch(/could not be saved/);
  await pick('Dark');
  expect(theme.storageError).toBeNull();
  expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
});

test('invalid stored values fall back to system and rapid changes save in order', async () => {
  await AsyncStorage.setItem(THEME_STORAGE_KEY, 'invalid');
  await render();
  expect(theme.preference).toBe('system');
  await Renderer.act(async () => {
    theme.setPreference('dark');
    theme.setPreference('light');
    theme.setPreference('system');
  });
  expect(await AsyncStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
});
