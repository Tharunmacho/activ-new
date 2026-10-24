import { NativeModules } from 'react-native';
import { ensureDownloadsPermission } from './downloadsPermission';

export interface SpreadsheetReport { filename: string; mimeType: string; base64: string }
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Save the typed Excel workbook without converting its phone numbers to numbers. */
export async function saveSpreadsheetReport(report: SpreadsheetReport): Promise<boolean> {
  if (report?.mimeType !== XLSX_MIME || !report.base64?.startsWith('UEsDB') || !/^[A-Za-z0-9+/]+={0,2}$/.test(report.base64)) {
    throw new Error('The downloaded Excel report is invalid. Please try again.');
  }
  const exporter = NativeModules.ReportExport;
  if (!exporter?.saveSpreadsheet) throw new Error('Install the latest ACTIV app to save Excel reports.');
  const name = report.filename.replace(/\.xlsx$/i, '').replace(/[^a-zA-Z0-9._ -]/g, '-').replace(/^[. ]+/, '').slice(0, 110).trim() || 'activ-report';
  await ensureDownloadsPermission();
  return exporter.saveSpreadsheet(name + '.xlsx', report.base64);
}

/** Save a UTF-8 CSV directly to the device's Downloads folder. */
export async function saveCsvReport(csv: string, filename: string): Promise<boolean> {
  if (!csv.trim()) throw new Error('There is no report to export.');
  const exporter = NativeModules.ReportExport;
  if (!exporter?.saveCsv) throw new Error('Install the latest ACTIV app to save report files.');
  const name = filename.replace(/\.csv$/i, '').replace(/[^a-zA-Z0-9._ -]/g, '-').replace(/^[. ]+/, '').slice(0, 100).trim() || 'activ-report';
  // Excel needs the BOM to read names and the rupee symbol correctly.
  const contents = csv.startsWith('\uFEFF') ? csv : `\uFEFF${csv}`;
  await ensureDownloadsPermission();
  return exporter.saveCsv(`${name}.csv`, contents);
}
