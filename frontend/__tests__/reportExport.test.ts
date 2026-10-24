import { NativeModules } from 'react-native';
import { saveCsvReport, saveSpreadsheetReport } from '../src/services/reportExport';

beforeEach(() => { NativeModules.ReportExport = { saveCsv: jest.fn().mockResolvedValue(true), saveSpreadsheet: jest.fn().mockResolvedValue(true) }; });
afterEach(() => { delete NativeModules.ReportExport; });

test('saves a CSV file with readable Unicode content and a safe filename', async () => {
  await expect(saveCsvReport('Name,Amount\r\nதமிழ்,₹500', '../Membership/October.csv')).resolves.toBe(true);
  expect(NativeModules.ReportExport.saveCsv).toHaveBeenCalledWith('-Membership-October.csv', '\uFEFFName,Amount\r\nதமிழ்,₹500');
});
test('cancellation returns without an error and an existing BOM is preserved', async () => {
  NativeModules.ReportExport.saveCsv.mockResolvedValue(false);
  await expect(saveCsvReport('\uFEFFName\r\nAsha', 'members.csv')).resolves.toBe(false);
  expect(NativeModules.ReportExport.saveCsv).toHaveBeenCalledWith('members.csv', '\uFEFFName\r\nAsha');
});
test('empty data, older binaries and write failures are reported instead of sharing raw text', async () => {
  await expect(saveCsvReport(' ', 'empty.csv')).rejects.toThrow('no report');
  NativeModules.ReportExport.saveCsv.mockRejectedValue(new Error('Storage full'));
  await expect(saveCsvReport('Name', 'members.csv')).rejects.toThrow('Storage full');
  delete NativeModules.ReportExport;
  await expect(saveCsvReport('Name', 'members.csv')).rejects.toThrow('latest ACTIV app');
});

const spreadsheet = { filename: '../Report/October.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: 'UEsDBAAAAAA=' };
test('saves binary Excel content unchanged with an xlsx filename and preserves cancellation', async () => {
  await expect(saveSpreadsheetReport(spreadsheet)).resolves.toBe(true);
  expect(NativeModules.ReportExport.saveSpreadsheet).toHaveBeenCalledWith('-Report-October.xlsx', spreadsheet.base64);
  NativeModules.ReportExport.saveSpreadsheet.mockResolvedValue(false);
  await expect(saveSpreadsheetReport(spreadsheet)).resolves.toBe(false);
});
test('rejects a CSV or error response disguised as Excel and clearly handles older app versions', async () => {
  await expect(saveSpreadsheetReport({ ...spreadsheet, mimeType: 'text/csv' })).rejects.toThrow('invalid');
  await expect(saveSpreadsheetReport({ ...spreadsheet, base64: 'server error' })).rejects.toThrow('invalid');
  expect(NativeModules.ReportExport.saveSpreadsheet).not.toHaveBeenCalled();
  delete NativeModules.ReportExport.saveSpreadsheet;
  await expect(saveSpreadsheetReport(spreadsheet)).rejects.toThrow('latest ACTIV app');
});
