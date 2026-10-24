import api from '../src/services/api';
import { fetchSpreadsheet } from '../src/services/spreadsheetDownload';

jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));

test('requests the authenticated workbook transport and keeps membership filters', async () => {
  const report = { filename: 'membership-members.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: 'UEsDBAAAAAA=' };
  (api.get as jest.Mock).mockResolvedValue({ data: { success: true, data: report } });
  await expect(fetchSpreadsheet('/admin/super/membership/registrations/export', { tab: 'members', filter: 'active', search: 'Tamil' })).resolves.toEqual(report);
  expect(api.get).toHaveBeenCalledWith('/admin/super/membership/registrations/export', {
    params: { tab: 'members', filter: 'active', search: 'Tamil', format: 'xlsx', encoding: 'base64' }, timeout: 120000,
  });
});
test('does not save server errors or old text exports as a workbook', async () => {
  (api.get as jest.Mock).mockResolvedValue({ data: 'Name,Email' });
  await expect(fetchSpreadsheet('/events/test/bookings/export')).rejects.toThrow('could not be downloaded');
});
