import { NativeModules, Platform } from 'react-native';
import { pick, keepLocalCopy, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { API_BASE_URL } from '../config/api.config';
import { getAuthToken } from './api';
import { ensureDownloadsPermission } from './downloadsPermission';

const MIME: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv', rtf: 'application/rtf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm',
};
export type ChatDraftAttachment = { uri: string; type: string; name: string; size?: number; kind: 'image' | 'file' | 'audio' };
export type ChatAttachment = { id: string; url: string; name: string; mimeType: string; size: number; kind: 'image' | 'file' | 'audio'; token?: string };
export const fileSizeLabel = (size?: number) => !size ? '' : size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;

export function validateChatFile(name: string, type: string | null, size?: number | null) {
  const safeName = String(name || '').split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f]/g, '').trim() || '';
  const extension = safeName.split('.').pop()?.toLowerCase() || '';
  const expected = MIME[extension];
  const aliases: Record<string, string> = { 'image/jpg': 'image/jpeg', 'text/comma-separated-values': 'text/csv', 'text/rtf': 'application/rtf', 'audio/x-m4a': 'audio/mp4', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/mp3': 'audio/mpeg', 'audio/x-aac': 'audio/aac', 'application/ogg': 'audio/ogg' };
  if (!expected || type && type !== 'application/octet-stream' && (aliases[type] || type) !== expected) {
    throw new Error('Choose a photo, document or MP3, M4A, AAC, WAV, Ogg or WebM audio file.');
  }
  const kind = expected.startsWith('image/') ? 'image' : expected.startsWith('audio/') ? 'audio' : 'file';
  const limit = (kind === 'image' ? 5 : 10) * 1024 * 1024;
  if (size !== null && size !== undefined && (size <= 0 || size > limit)) throw new Error(kind === 'image' ? 'Photos must be 5 MB or smaller.' : 'Documents and audio must be 10 MB or smaller.');
  return { name: safeName, type: expected, size: size ?? undefined, kind } as const;
}

export async function pickChatDocument(audio = false): Promise<ChatDraftAttachment | null> {
  try {
    const [file] = await pick({ mode: 'import', allowMultiSelection: false, allowVirtualFiles: false,
      type: audio ? [types.audio] : [types.pdf, types.doc, types.docx, types.xls, types.xlsx, types.ppt, types.pptx, types.plainText, ...[types.csv].flat(), Platform.OS === 'ios' ? 'public.rtf' : 'application/rtf'] });
    if (!file) return null;
    if (!file.uri || file.error || file.hasRequestedType === false) throw new Error('Download the document to your phone, then choose it again.');
    const meta = validateChatFile(file.name || '', file.type, file.size);
    if (audio && meta.kind !== 'audio') throw new Error('Choose an audio recording.');
    const [copy] = await keepLocalCopy({ destination: 'cachesDirectory', files: [{ uri: file.uri, fileName: meta.name }] });
    if (copy?.status !== 'success') throw new Error('The document could not be opened. Choose it again.');
    return { ...meta, uri: copy.localUri };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return null;
    throw error;
  }
}

export async function chatAudioSource(file: ChatAttachment) {
  if (file.kind !== 'audio' || !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(file.id)) throw new Error('This audio is unavailable.');
  const token = await getAuthToken();
  if (!token) throw new Error('Sign in again to play this audio.');
  return { uri: `${API_BASE_URL}/messages/attachments/${file.id}`, headers: { Authorization: `Bearer ${token}` }, type: file.name.split('.').pop() };
}

const downloading = new Map<string, Promise<unknown>>();
export async function downloadChatAttachment(file: ChatAttachment): Promise<void> {
  if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(file?.id || '')) throw new Error('This attachment is unavailable.');
  const existing = downloading.get(file.id);
  if (existing) { await existing; return; }
  const operation = (async () => {
    const exporter = NativeModules.ReportExport;
    if (!exporter?.downloadChatFile) throw new Error('Install the latest ACTIV app to download chat documents.');
    const token = await getAuthToken();
    if (!token) throw new Error('Sign in again to download this attachment.');
    await ensureDownloadsPermission();
    // The endpoint comes from configuration and a UUID, never an attachment URL.
    await exporter.downloadChatFile(`${API_BASE_URL}/messages/attachments/${file.id}`, token, file.name, file.mimeType);
  })();
  downloading.set(file.id, operation);
  try { await operation; } finally { downloading.delete(file.id); }
}
