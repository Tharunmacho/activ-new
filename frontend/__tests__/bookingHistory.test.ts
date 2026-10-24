import api from '../src/services/api';
import { listEventsForPicker } from '../src/services/superApi';

jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn() } }));

test('booking picker keeps deleted event history without querying or restoring events', async () => {
  (api.get as jest.Mock).mockResolvedValue({ data: { success: true, data: { events: [
    { id: 'deleted', title: 'Past workshop', bookingHistoryOnly: true, historyCategory: 'deleted', totalSeats: 0, price: 0 },
    { id: 'live', title: 'Upcoming workshop', historyCategory: 'current', totalSeats: 40, price: 500 },
    { id: 'past', title: 'Completed workshop', historyCategory: 'past', totalSeats: 40, price: 500 },
  ] } } });
  const rows = await listEventsForPicker();
  expect(rows).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'deleted', bookingHistoryOnly: true, historyCategory: 'deleted' }),
    expect.objectContaining({ id: 'live', capacity: 40, registrationFee: 500, historyCategory: 'current' }),
    expect.objectContaining({ id: 'past', historyCategory: 'past' }),
  ]));
  expect(api.get).toHaveBeenCalledWith('/events/bookings/overview', { params: { includeDrafts: 1 } });
});
