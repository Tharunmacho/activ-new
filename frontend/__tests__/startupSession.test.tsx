import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingScreen from '../src/screens/auth/OnboardingScreen';
import StartupScreen from '../src/components/StartupScreen';
import api from '../src/services/api';
import { clearSession, homeForRole } from '../src/services/session';

jest.mock('../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('../src/services/session', () => ({
  homeForRole: jest.fn(),
  clearSession: jest.fn(),
  isAdminRole: (role: string) => role.endsWith('_admin'),
}));
let screen: Renderer.ReactTestRenderer | undefined;
const navigation = {
  replace: jest.fn(),
  reset: jest.fn(),
  isFocused: jest.fn(() => true),
};
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  navigation.isFocused.mockReturnValue(true);
  (api.get as jest.Mock).mockResolvedValue({ data: {} });
  (homeForRole as jest.Mock).mockResolvedValue('PaidDashboard');
  (clearSession as jest.Mock).mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => {
    screen?.unmount();
  });
  screen = undefined;
});
const mount = async () => {
  await act(async () => {
    screen = Renderer.create(
      <OnboardingScreen navigation={navigation as any} />,
    );
  });
};
const signedIn = async (role = 'member') => {
  await AsyncStorage.multiSet([
    ['@activ_auth_token', 'token'],
    ['@activ_user_role', role],
  ]);
};

it('opens public content directly for a visitor and removes the legacy password', async () => {
  await AsyncStorage.setItem('@activ_user_password', 'legacy');
  await mount();
  expect(navigation.replace).toHaveBeenCalledWith('PublicExplore');
  expect(api.get).not.toHaveBeenCalled();
  expect(await AsyncStorage.getItem('@activ_user_password')).toBeNull();
});

it('keeps the startup view until server revalidation finishes before resolving the current home', async () => {
  await signedIn();
  let finish!: () => void;
  (api.get as jest.Mock).mockReturnValue(
    new Promise<void>(resolve => {
      finish = resolve;
    }),
  );
  await mount();
  expect(screen!.root.findAllByType(StartupScreen)).toHaveLength(1);
  expect(navigation.reset).not.toHaveBeenCalled();
  expect(homeForRole).not.toHaveBeenCalled();
  expect(api.get).toHaveBeenCalledWith('/auth/me', { timeout: 10000 });
  await act(async () => {
    finish();
  });
  expect(homeForRole).toHaveBeenCalledWith('member', undefined, 10000);
  expect(navigation.reset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: 'PaidDashboard' }],
  });
});

it.each([
  ['member', 'Login'],
  ['attendance_admin', 'AdminLogin'],
])(
  'routes an invalid %s session to sign-in without opening a home',
  async (role, target) => {
    await signedIn(role);
    (api.get as jest.Mock).mockRejectedValue({ response: { status: 401 } });
    await mount();
    expect(navigation.replace).toHaveBeenCalledWith(target);
    expect(homeForRole).not.toHaveBeenCalled();
    expect(navigation.reset).not.toHaveBeenCalled();
  },
);

it('preserves the existing offline fallback and routes unsupported roles to public content', async () => {
  await signedIn('cms_admin');
  (api.get as jest.Mock).mockRejectedValue(new Error('Network unavailable'));
  (homeForRole as jest.Mock).mockResolvedValue(null);
  await mount();
  expect(clearSession).toHaveBeenCalledTimes(1);
  expect(navigation.replace).toHaveBeenCalledWith('PublicExplore');
});
it('preserves the signed-in member retry path when revalidation is offline', async () => {
  await signedIn();
  (api.get as jest.Mock).mockRejectedValue(new Error('Network unavailable'));
  (homeForRole as jest.Mock).mockResolvedValue('MemberMain');
  await mount();
  expect(clearSession).not.toHaveBeenCalled();
  expect(navigation.reset).toHaveBeenCalledWith({
    index: 0,
    routes: [{ name: 'MemberMain' }],
  });
});

it('does not redirect over a deep link opened while the session check was pending', async () => {
  await signedIn();
  let finish!: () => void;
  (api.get as jest.Mock).mockReturnValue(
    new Promise<void>(resolve => {
      finish = resolve;
    }),
  );
  await mount();
  navigation.isFocused.mockReturnValue(false);
  await act(async () => {
    finish();
  });
  expect(homeForRole).not.toHaveBeenCalled();
  expect(navigation.reset).not.toHaveBeenCalled();
  expect(navigation.replace).not.toHaveBeenCalled();
});
