import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { saveCsvReport } from '../src/services/reportExport';

const originalOS = Platform.OS;
const originalVersion = Object.getOwnPropertyDescriptor(Platform, 'Version');
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  NativeModules.ReportExport = { saveCsv: jest.fn().mockResolvedValue(true) };
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  if (originalVersion) Object.defineProperty(Platform, 'Version', originalVersion);
  delete NativeModules.ReportExport;
});
test('modern Android saves directly without asking for broad storage access', async () => {
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 36 });
  await expect(saveCsvReport('Name\nSample', 'members.csv')).resolves.toBe(true);
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
  expect(NativeModules.ReportExport.saveCsv).toHaveBeenCalledTimes(1);
});
test('older Android requires permission and never saves after denial', async () => {
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 28 });
  await expect(saveCsvReport('Name\nSample', 'members.csv')).rejects.toThrow('Storage access');
  expect(NativeModules.ReportExport.saveCsv).not.toHaveBeenCalled();
  (PermissionsAndroid.request as jest.Mock).mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  await expect(saveCsvReport('Name\nSample', 'members.csv')).resolves.toBe(true);
});
