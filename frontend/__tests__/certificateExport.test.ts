import * as native from 'react-native';
import { saveCertificatePdf } from '../src/services/certificateExport';

jest.mock('react-native', () => Object.defineProperties({}, {
  ...Object.getOwnPropertyDescriptors(jest.requireActual('react-native')),
  findNodeHandle: { value: jest.fn(() => 104), configurable: true, enumerable: true },
}));

beforeEach(() => { native.NativeModules.ReportExport = { savePdf: jest.fn().mockResolvedValue(true) }; });
afterEach(() => { jest.restoreAllMocks(); delete native.NativeModules.ReportExport; });

test('saves a safe .pdf filename and the complete certificate sheet handle', async () => {
  const sheet = {} as native.View;
  await expect(saveCertificatePdf(sheet, '../ACTIV/TAX-004.pdf')).resolves.toBe(true);
  expect(native.findNodeHandle).toHaveBeenCalledWith(sheet);
  expect(native.NativeModules.ReportExport.savePdf).toHaveBeenCalledWith('-ACTIV-TAX-004.pdf', 104);
});

test('handles loading, cancelled save, old binaries and storage failure honestly', async () => {
  await expect(saveCertificatePdf(null, 'certificate')).rejects.toThrow('finish loading');
  expect(native.NativeModules.ReportExport.savePdf).not.toHaveBeenCalled();
  native.NativeModules.ReportExport.savePdf.mockResolvedValue(false);
  await expect(saveCertificatePdf({} as native.View, 'certificate')).resolves.toBe(false);
  native.NativeModules.ReportExport.savePdf.mockRejectedValue(new Error('Storage full'));
  await expect(saveCertificatePdf({} as native.View, 'certificate')).rejects.toThrow('Storage full');
  delete native.NativeModules.ReportExport;
  await expect(saveCertificatePdf({} as native.View, 'certificate')).rejects.toThrow('latest ACTIV Android app');
});
