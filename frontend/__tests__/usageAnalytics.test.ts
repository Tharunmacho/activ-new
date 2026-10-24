import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps } from '@react-native-firebase/app';
import { logEvent, setUserId, setAnalyticsCollectionEnabled, setConsent } from '@react-native-firebase/analytics';
import { analyticsLogin, analyticsLogout, initAnalytics, setAnalyticsAllowed, trackScreen } from '../src/services/analytics';

test('native usage analytics respects opt-in and excludes personal data', async () => {
  (getApps as jest.Mock).mockReturnValue([{}]);
  await AsyncStorage.clear();
  await initAnalytics();
  await analyticsLogin({ id: 'a'.repeat(24), email: 'private@example.test' });
  await trackScreen('MemberHome');
  expect(logEvent).not.toHaveBeenCalled();
  await setAnalyticsAllowed(true);
  await analyticsLogin({ id: 'a'.repeat(24), loginMethod: 'linkedin', email: 'private@example.test', fullName: 'Private member' });
  await trackScreen('MemberHome');
  await trackScreen('MemberHome?token=private');
  expect(logEvent).toHaveBeenCalledTimes(2);
  expect(JSON.stringify((logEvent as jest.Mock).mock.calls)).not.toMatch(/private@example|Private member|token=/);
  expect(setUserId).toHaveBeenCalledWith(undefined, 'a'.repeat(24));
  expect(setConsent).toHaveBeenLastCalledWith(undefined, { analyticsStorage: true, adStorage: false, adUserData: false, adPersonalization: false });
  await analyticsLogout();
  expect(setUserId).toHaveBeenLastCalledWith(undefined, null);
  await setAnalyticsAllowed(false);
  await trackScreen('MemberHome');
  expect(logEvent).toHaveBeenCalledTimes(2);
  expect(setAnalyticsCollectionEnabled).toHaveBeenLastCalledWith(undefined, false);
});
