import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { downloadPublicFile, isPublicDownloadUrl } from '../src/services/publicDownload';

jest.mock('../src/config/api.config', () => ({ resolveMediaUrl: (value: string) => `https://api.activ.org.in/${value.replace(/^\/+/, '')}` }));
const originalOS = Platform.OS;
const originalVersion = Object.getOwnPropertyDescriptor(Platform, 'Version');
const receipt = { id: '1234', filename: 'report-unique.pdf', status: 'started' };
const link = (name: string) => `https://files.example.test/${name}.pdf`;
beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 36 });
  NativeModules.ReportExport = { downloadPublicFile: jest.fn().mockResolvedValue(receipt) };
  jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  jest.spyOn(PermissionsAndroid, 'request').mockResolvedValue(PermissionsAndroid.RESULTS.DENIED);
});
afterEach(() => {
  jest.restoreAllMocks(); delete NativeModules.ReportExport;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  if (originalVersion) Object.defineProperty(Platform, 'Version', originalVersion);
});

test.each(['/uploads/attachments/guide.pdf', 'uploads/files/guide', 'https://files.example.test/guide.PDF?signature=public#page=2', 'https://cdn.example.test/photos/photo.jpg', 'https://files.example.test/guide%2Ezip'])('identifies a published attachment: %s', url => {
  expect(isPublicDownloadUrl(url)).toBe(true);
});

test.each(['javascript:alert(1)', 'file:///data/private/report.pdf', 'content://report.pdf', 'data:application/pdf;base64,AA', 'http://files.example.test/report.pdf', '//files.example.test/report.pdf', 'https://user:password@files.example.test/report.pdf', 'https://files.example.test\\@other.test/file.pdf', 'https://files.example.test:99999/file.pdf', '/gallery/photos', 'https://files.example.test/about', 'https://files.example.test/re\nport.pdf'])('rejects an unsafe scheme, credentials or a normal page: %s', url => {
  expect(isPublicDownloadUrl(url)).toBe(false);
});

test('downloads relative CMS files over HTTPS, with sanitized names and no storage prompt on Android 10+', async () => {
  await expect(downloadPublicFile('/uploads/attachments/download-test.pdf#page=3', '../../Tamil Nadu/Guide')).resolves.toEqual(receipt);
  expect(NativeModules.ReportExport.downloadPublicFile).toHaveBeenCalledWith('https://api.activ.org.in/uploads/attachments/download-test.pdf', '-..-Tamil Nadu-Guide.pdf');
  expect(NativeModules.ReportExport.downloadPublicFile.mock.calls[0]).toHaveLength(2);
  expect(PermissionsAndroid.check).not.toHaveBeenCalled();
  expect(PermissionsAndroid.request).not.toHaveBeenCalled();
});

test('legacy Android asks for Downloads permission and never enqueues after denial', async () => {
  Object.defineProperty(Platform, 'Version', { configurable: true, value: 28 });
  await expect(downloadPublicFile(link('legacy-denied'))).rejects.toThrow('Storage access');
  expect(NativeModules.ReportExport.downloadPublicFile).not.toHaveBeenCalled();
  (PermissionsAndroid.request as jest.Mock).mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
  await expect(downloadPublicFile(link('legacy-allowed'))).resolves.toEqual(receipt);
  expect(NativeModules.ReportExport.downloadPublicFile).toHaveBeenCalledTimes(1);
});

test('concurrent and rapid repeat taps share one Android queue request', async () => {
  let finish!: (value: any) => void;
  NativeModules.ReportExport.downloadPublicFile.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const first = downloadPublicFile(link('deduplicate'), 'First label');
  const second = downloadPublicFile(link('deduplicate'), 'Other label');
  await Promise.resolve();
  expect(NativeModules.ReportExport.downloadPublicFile).toHaveBeenCalledTimes(1);
  finish(receipt);
  expect(await Promise.all([first, second])).toEqual([receipt, receipt]);
  expect(await downloadPublicFile(link('deduplicate'))).toEqual(receipt);
  expect(NativeModules.ReportExport.downloadPublicFile).toHaveBeenCalledTimes(1);
});

test('a failed enqueue is retryable and invalid acknowledgements never claim completion', async () => {
  NativeModules.ReportExport.downloadPublicFile.mockRejectedValueOnce(new Error('Downloads unavailable'));
  await expect(downloadPublicFile(link('retry'))).rejects.toThrow('Downloads unavailable');
  await expect(downloadPublicFile(link('retry'))).resolves.toEqual(receipt);
  expect(NativeModules.ReportExport.downloadPublicFile).toHaveBeenCalledTimes(2);
  NativeModules.ReportExport.downloadPublicFile.mockResolvedValueOnce({ ...receipt, id: '-1' });
  await expect(downloadPublicFile(link('invalid-id'))).rejects.toThrow('did not confirm');
  NativeModules.ReportExport.downloadPublicFile.mockResolvedValueOnce({ ...receipt, status: 'saved' });
  await expect(downloadPublicFile(link('invalid-state'))).rejects.toThrow('did not confirm');
});

test('unsafe URLs, older binaries and unsupported platforms fail without external browser fallback', async () => {
  for (const url of ['http://host.test/file.pdf', 'https://u:p@host.test/file.pdf', 'https://host.test/fi\nle.pdf', 'data:application/pdf,AA']) {
    await expect(downloadPublicFile(url)).rejects.toThrow(/HTTPS/);
  }
  expect(NativeModules.ReportExport.downloadPublicFile).not.toHaveBeenCalled();
  delete NativeModules.ReportExport;
  await expect(downloadPublicFile(link('old-version'))).rejects.toThrow('latest ACTIV app');
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  await expect(downloadPublicFile(link('ios'))).rejects.toThrow('Android app');
});

test('external public hosts retain their URL and useful non-ASCII filenames', async () => {
  await expect(downloadPublicFile('https://cdn.example.test/uploads/தமிழ்.pdf?public=1')).resolves.toEqual(receipt);
  expect(NativeModules.ReportExport.downloadPublicFile).toHaveBeenCalledWith('https://cdn.example.test/uploads/தமிழ்.pdf?public=1', 'தமிழ்.pdf');
});
