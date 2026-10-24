import { pick, keepLocalCopy } from '@react-native-documents/picker';
import { pickEventDocument } from '../src/services/eventDocuments';

const pdf = { uri: 'content://documents/123', name: 'Agenda.pdf', type: 'application/pdf', size: 50000, hasRequestedType: true };
beforeEach(() => {
  jest.clearAllMocks();
  (pick as jest.Mock).mockResolvedValue([pdf]);
  (keepLocalCopy as jest.Mock).mockResolvedValue([{ status: 'success', localUri: 'file:///cache/Agenda.pdf' }]);
});
test('the native PDF becomes a readable upload asset with the original file name and MIME type', async () => {
  expect(await pickEventDocument()).toEqual({ uri: 'file:///cache/Agenda.pdf', fileName: 'Agenda.pdf', type: 'application/pdf', fileSize: 50000 });
  expect(keepLocalCopy).toHaveBeenCalledWith({ destination: 'cachesDirectory', files: [{ uri: pdf.uri, fileName: 'Agenda.pdf' }] });
});
test('cancelling the phone picker does not upload or show an error', async () => {
  (pick as jest.Mock).mockRejectedValue({ code: 'OPERATION_CANCELED' });
  expect(await pickEventDocument()).toBeNull();
  expect(keepLocalCopy).not.toHaveBeenCalled();
});
test.each([
  [{ ...pdf, size: 21 * 1024 * 1024 }, /20 MB/],
  [{ ...pdf, type: 'application/vnd.android.package-archive', name: 'app.apk' }, /Choose a PDF/],
  [{ ...pdf, hasRequestedType: false }, /Choose a PDF/],
])('unusable selections are rejected before copying or uploading', async (file, error) => {
  (pick as jest.Mock).mockResolvedValue([file]);
  await expect(pickEventDocument()).rejects.toThrow(error as RegExp);
  expect(keepLocalCopy).not.toHaveBeenCalled();
});
test('a failed local copy is shown as a recoverable error', async () => {
  (keepLocalCopy as jest.Mock).mockResolvedValue([{ status: 'error', copyError: 'No space' }]);
  await expect(pickEventDocument()).rejects.toThrow('could not be copied');
});
