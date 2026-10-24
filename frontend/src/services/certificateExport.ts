import { findNodeHandle, NativeModules, View } from 'react-native';
import { ensureDownloadsPermission } from './downloadsPermission';

/** Save the complete A4 certificate directly in the device's Downloads folder. */
export async function saveCertificatePdf(view: View | null, filename: string): Promise<boolean> {
  const exporter = NativeModules.ReportExport;
  if (!exporter?.savePdf) throw new Error('Install the latest ACTIV Android app to download certificate PDFs.');
  const tag = view ? findNodeHandle(view) : null;
  if (!tag) throw new Error('Wait for the certificate to finish loading, then try again.');
  const name = filename.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._ -]/g, '-').replace(/^[. ]+/, '').slice(0, 100).trim() || 'ACTIV-certificate';
  await ensureDownloadsPermission();
  return exporter.savePdf(`${name}.pdf`, tag);
}
