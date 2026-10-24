import { NativeModules, Platform } from 'react-native';
import { resolveMediaUrl } from '../config/api.config';
import { ensureDownloadsPermission } from './downloadsPermission';

export type PublicDownloadReceipt = { id: string; filename: string; status: 'started' };
const fileExtension = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|rtf|odt|ods|odp|zip|rar|7z|jpe?g|png|webp|gif|mp4|webm|mov|mp3|wav)$/i;
const pending = new Map<string, Promise<PublicDownloadReceipt>>();
const recent = new Map<string, { receipt: PublicDownloadReceipt; at: number }>();

export function publicDownloadUrl(value: string): string {
  const raw = String(value || '').trim();
  if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw)) throw new Error('Choose a valid public HTTPS file link.');
  // Only genuine relative uploads are re-anchored. Never rewrite an external
  // URL or mistake a scheme such as javascript: for a relative media path.
  const url = /^\/?uploads\//.test(raw) ? resolveMediaUrl(raw) : raw;
  const clean = url.split('#')[0];
  const match = /^https:\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?(\/[^#]*)?$/i.exec(clean);
  if (!match || !match[1] || (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))) {
    throw new Error('Only public HTTPS file links can be downloaded.');
  }
  return clean;
}

/** Route known CMS documents/media to Downloads instead of opening a browser. */
export function isPublicDownloadUrl(value: string): boolean {
  try {
    const url = publicDownloadUrl(value);
    const path = decodeURIComponent(url.replace(/^https:\/\/[^/]+/i, '').split('?')[0]);
    return fileExtension.test(path) || /^\/uploads\/[^?]+/i.test(path);
  } catch { return false; }
}

function downloadName(url: string, preferred?: string): string {
  let leaf = url.split('?')[0].split('/').pop() || 'activ-download';
  try { leaf = decodeURIComponent(leaf); } catch { /* Keep an escaped filename readable through sanitizing. */ }
  const extension = /\.([a-z0-9]{1,10})$/i.exec(leaf)?.[0] || '';
  let name = String(preferred || leaf).replace(/[^\p{L}\p{N}\p{M}._ -]/gu, '-').replace(/^[. ]+|[. ]+$/g, '').slice(0, 100) || 'activ-download';
  if (extension && !/\.[a-z0-9]{1,10}$/i.test(name)) name += extension;
  return name;
}

/** Acknowledges Android's queue, never claims the download has completed. */
export async function downloadPublicFile(value: string, filename?: string): Promise<PublicDownloadReceipt> {
  const url = publicDownloadUrl(value);
  if (Platform.OS !== 'android') throw new Error('Direct Downloads are available in the ACTIV Android app.');
  const exporter = NativeModules.ReportExport;
  if (!exporter?.downloadPublicFile) throw new Error('Install the latest ACTIV app to download attachments.');
  const active = pending.get(url);
  if (active) return active;
  const now = Date.now();
  for (const [key, result] of recent) if (now - result.at > 5000) recent.delete(key);
  const justStarted = recent.get(url);
  if (justStarted) return justStarted.receipt;
  const operation = (async () => {
    await ensureDownloadsPermission();
    // No fetch/axios client, saved credentials, request headers or browser handoff.
    const receipt = await exporter.downloadPublicFile(url, downloadName(url, filename));
    if (receipt?.status !== 'started' || !/^\d+$/.test(String(receipt.id)) || Number(receipt.id) <= 0 || !receipt.filename) {
      throw new Error('Android did not confirm the download. Check Downloads before trying again.');
    }
    const result: PublicDownloadReceipt = { id: String(receipt.id), filename: String(receipt.filename), status: 'started' };
    recent.set(url, { receipt: result, at: Date.now() });
    return result;
  })();
  pending.set(url, operation);
  try { return await operation; }
  finally { pending.delete(url); }
}
