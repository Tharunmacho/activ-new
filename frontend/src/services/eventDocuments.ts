import { Platform } from 'react-native';
import { pick, keepLocalCopy, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';

const DOCUMENT_TYPES = /^(application\/(pdf|msword|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-(excel|powerpoint)|vnd\.oasis\.opendocument\.[a-z.]+|zip|x-zip-compressed|rtf)|text\/(plain|csv)|image\/[a-z0-9.+-]+)$/i;
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  csv: 'text/csv', txt: 'text/plain', rtf: 'application/rtf', zip: 'application/zip',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet', odp: 'application/vnd.oasis.opendocument.presentation',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', heic: 'image/heic',
};

/** Import one document into the app cache before uploading it to /cms/attachments. */
export async function pickEventDocument() {
  try {
    const [file] = await pick({
      mode: 'import', allowMultiSelection: false, allowVirtualFiles: false,
      type: [types.pdf, types.doc, types.docx, types.xls, types.xlsx, types.ppt, types.pptx, types.images, types.zip, types.plainText, ...[types.csv].flat(),
        ...(Platform.OS === 'ios' ? ['public.rtf', 'org.oasis-open.opendocument.text', 'org.oasis-open.opendocument.spreadsheet', 'org.oasis-open.opendocument.presentation'] : ['application/rtf', 'application/vnd.oasis.opendocument.text', 'application/vnd.oasis.opendocument.spreadsheet', 'application/vnd.oasis.opendocument.presentation'])],
    });
    if (!file) return null;
    if (file.error || !file.uri) throw new Error('This document could not be opened. Download it to your phone and try again.');
    if (file.size !== null && file.size > 20 * 1024 * 1024) throw new Error('Files must be 20 MB or smaller.');
    const fileName = (file.name || 'document').split(/[\\/]/).pop() || 'document';
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    let type = file.type || MIME_BY_EXTENSION[extension] || '';
    if (type === 'application/octet-stream') type = MIME_BY_EXTENSION[extension] || '';
    if (type === 'text/comma-separated-values') type = 'text/csv';
    if (!DOCUMENT_TYPES.test(type) || file.hasRequestedType === false) throw new Error('Choose a PDF, Word, Excel, PowerPoint, text, image or ZIP file.');
    const [copy] = await keepLocalCopy({ destination: 'cachesDirectory', files: [{ uri: file.uri, fileName }] });
    if (copy.status !== 'success') throw new Error('The document could not be copied. Please choose the file again.');
    return { uri: copy.localUri, fileName, type, fileSize: file.size ?? undefined };
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) return null;
    throw error;
  }
}
