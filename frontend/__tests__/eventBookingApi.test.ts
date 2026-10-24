import api from '../src/services/api';
import publicApi from '../src/services/publicApi';
import { getBookableEvent, checkEventBooking, createEventBooking } from '../src/services/memberApi';

jest.mock('../src/services/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));
jest.mock('../src/services/publicApi', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  for (const client of [api, publicApi]) {
    (client.get as jest.Mock).mockResolvedValue({ data: { data: { amount: client === publicApi ? 1000 : 500 } } });
    (client.post as jest.Mock).mockResolvedValue({ data: { data: { bookingRef: 'BOOK-TEST' } } });
  }
});

test.each([true, false])('price, duplicate check and booking all use the same guest mode: %s', async guest => {
  const client = guest ? publicApi : api;
  const unused = guest ? api : publicApi;
  const contact = { name: 'Visitor', email: 'visitor@example.test', phone: '9000000001' };
  const body = { ...contact, noOfPersons: 1, participants: [contact] };
  expect(await getBookableEvent('event/id', guest)).toEqual({ amount: guest ? 1000 : 500 });
  await checkEventBooking('event/id', body, guest);
  await createEventBooking('event/id', body, guest);
  expect(client.get).toHaveBeenCalledWith('/event-bookings/event/event%2Fid');
  expect(client.post).toHaveBeenNthCalledWith(1, '/event-bookings/event/event%2Fid/check', body);
  expect(client.post).toHaveBeenNthCalledWith(2, '/event-bookings/event/event%2Fid', body);
  expect(unused.get).not.toHaveBeenCalled();
  expect(unused.post).not.toHaveBeenCalled();
});
