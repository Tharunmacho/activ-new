import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { AppState, Text, type AppStateStatus } from 'react-native';
import AppUpdateGate from '../src/components/AppUpdateGate';
import StartupScreen from '../src/components/StartupScreen';
import { GradientButton } from '../src/ui';
import { AppThemeProvider } from '../src/ui/AppTheme';
import { checkAppUpdate, openAppUpdateStore } from '../src/services/appUpdates';

jest.mock('../src/services/appUpdates', () => ({
  checkAppUpdate: jest.fn(),
  openAppUpdateStore: jest.fn(),
}));
let screen: Renderer.ReactTestRenderer;
let foreground: (state: AppStateStatus) => void;
const required = {
  required: true,
  versionCode: 26,
  availableVersionCode: 27,
};
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_name, callback) => {
      foreground = callback;
      return { remove: jest.fn() };
    });
  (checkAppUpdate as jest.Mock).mockResolvedValue(required);
  (openAppUpdateStore as jest.Mock).mockResolvedValue(undefined);
});
afterEach(async () => {
  if (screen) await act(async () => screen.unmount());
  jest.restoreAllMocks();
});
const mount = async () => {
  await act(async () => {
    screen = Renderer.create(
      <AppUpdateGate>
        <Text>Private app content</Text>
      </AppUpdateGate>,
    );
  });
};
const copy = () =>
  screen.root
    .findAllByType(Text)
    .map(node => String(node.props.children || ''))
    .join(' ');
it('uses the shared startup presentation while withholding app content until the update check completes', async () => {
  let finish!: (value: { required: boolean }) => void;
  (checkAppUpdate as jest.Mock).mockReturnValue(
    new Promise(resolve => {
      finish = resolve;
    }),
  );
  await mount();
  expect(screen.root.findAllByType(StartupScreen)).toHaveLength(1);
  expect(copy()).not.toContain('Private app content');
  expect(copy()).not.toContain('Checking for app updates');
  await act(async () => {
    finish({ required: false });
  });
  expect(screen.root.findAllByType(StartupScreen)).toHaveLength(0);
  expect(copy()).toContain('Private app content');
});
it('blocks app content without a dismiss action, opens Play and rechecks after return', async () => {
  await mount();
  expect(copy()).toContain('Update required');
  expect(copy()).not.toContain('Private app content');
  await act(async () => {
    await screen.root
      .findAllByType(GradientButton)
      .find(node => node.props.label === 'Update on Google Play')!
      .props.onPress();
  });
  expect(openAppUpdateStore).toHaveBeenCalledTimes(1);
  expect(copy()).not.toContain('Private app content');
  await act(async () => {
    foreground('active');
  });
  expect(copy()).toContain('Update required');
  expect(copy()).not.toContain('Private app content');
  (checkAppUpdate as jest.Mock).mockResolvedValue({ required: false });
  await act(async () => {
    foreground('active');
  });
  expect(copy()).toContain('Private app content');
});
it('retains the gate after canceled/failed store launch and supports explicit retry', async () => {
  (openAppUpdateStore as jest.Mock).mockRejectedValue(
    new Error('Google Play could not be opened.'),
  );
  await mount();
  await act(async () => {
    await screen.root
      .findAllByType(GradientButton)
      .find(node => node.props.label === 'Update on Google Play')!
      .props.onPress();
  });
  expect(copy()).toContain('Google Play could not be opened.');
  expect(copy()).not.toContain('Private app content');
  await act(async () => {
    await screen.root.findAllByType(GradientButton).find(node => node.props.label === 'Check again')?.props.onPress();
  });
  expect(checkAppUpdate).toHaveBeenCalledTimes(2);
});
it('retains a confirmed update when a return check cannot read Play or cached storage', async () => {
  await mount();
  (checkAppUpdate as jest.Mock).mockResolvedValue({
    required: false,
    versionCode: 26,
    checkFailed: true,
  });
  await act(async () => {
    foreground('active');
  });
  expect(copy()).toContain('Update required');
  expect(copy()).toContain('Google Play could not be checked');
  expect(copy()).not.toContain('Private app content');
});

it('allows an explicit sun/moon choice while keeping the entire app gated', async () => {
  await act(async () => {
    screen = Renderer.create(<AppThemeProvider><AppUpdateGate><Text>Private app content</Text></AppUpdateGate></AppThemeProvider>);
  });
  const toggle = (label: string) => screen.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
  await act(async () => toggle('Use dark appearance').props.onPress());
  expect(toggle('Use dark appearance').props.accessibilityState.checked).toBe(true);
  expect(copy()).not.toContain('Private app content');
  await act(async () => toggle('Use light appearance').props.onPress());
  expect(toggle('Use light appearance').props.accessibilityState.checked).toBe(true);
  expect(copy()).toContain('Update required');
});
