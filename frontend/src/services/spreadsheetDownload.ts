import api from './api';
import type { SpreadsheetReport } from './reportExport';

/** Use the same authenticated report endpoint as the website, never a public URL. */
export async function fetchSpreadsheet(path: string, params: Record<string, string> = {}): Promise<SpreadsheetReport> {
  const response = await api.get(path, { params: { ...params, format: 'xlsx', encoding: 'base64' }, timeout: 120000 });
  const report = response?.data?.data;
  if (!report || typeof report.base64 !== 'string' || typeof report.filename !== 'string') {
    throw new Error('The Excel report could not be downloaded. Please refresh and try again.');
  }
  return report;
}
