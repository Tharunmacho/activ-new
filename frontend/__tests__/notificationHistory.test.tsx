import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import api from '../src/services/api';
import { ConsoleButton } from '../src/ui';
import { HistoryDeleteControl } from '../src/screens/admin/super/delivery/HistoryDeleteControl';
import { historySelection, previewHistoryDelete, type HistorySelection } from '../src/services/notificationHistoryApi';

jest.mock('../src/services/api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../src/services/superApi', () => ({ errorText: (error: Error) => error.message }));
const post = api.post as jest.Mock;
const preview = { matched: 500, reviewed: 500, eligible: 498, retained: 2, remaining: 0, truncated: false,
  ids: Array.from({ length: 498 }, (_, i) => `log:${i}`), token: 'actor-bound-snapshot', reasons: [{ reason: 'Messages waiting to send are kept.', count: 2 }] };
const done = jest.fn();
let tree: Renderer.ReactTestRenderer;
const props = (selection: HistorySelection) => ({ selection, onDone: done });
const mount = async (selection: HistorySelection = { view: 'reports', all: true, filters: { channel: 'push', status: 'failed', page: 3, limit: 25 } }) => {
  await act(async () => { tree = Renderer.create(<HistoryDeleteControl {...props(selection)} />); });
};
const button = (label: string) => {
  const found = tree.root.findAllByType(ConsoleButton).find(node => node.props.label === label);
  if (!found) throw new Error(`Missing ${label}`);
  return found;
};
const press = async (label: string) => { await act(async () => { await button(label).props.onPress(); }); };
const text = () => tree.root.findAllByType(Text).map(node => React.Children.toArray(node.props.children).filter(value => typeof value !== 'object').join('')).join(' ');
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  post.mockResolvedValue({ data: { data: preview } });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); jest.restoreAllMocks(); });

test('review uses all selected filters without pagination and requires an exact snapshot confirmation', async () => {
  await mount();
  expect(post).not.toHaveBeenCalled();
  await press('Clear logs');
  expect(post).toHaveBeenCalledWith('/notifications/history/delete-preview', { view: 'reports', filters: { channel: 'push', status: 'failed' }, all: true }, { timeout: 120000 });
  expect(text()).toContain('Delete 498 log entries');
  expect(text()).toContain('500 reviewed · 2 kept.');
  expect(text()).toContain("Notifications in people's accounts and messages waiting to send are kept.");
  expect(post).toHaveBeenCalledTimes(1);
  post.mockResolvedValueOnce({ data: { data: { removed: 497, retained: 1, reasons: [{ count: 1, reason: 'The message changed.' }] } } });
  await press('Confirm delete (498)');
  expect(post).toHaveBeenLastCalledWith('/notifications/history/delete', { ids: preview.ids, token: preview.token }, { timeout: 120000 });
  expect(done).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('History updated', expect.stringContaining('497 log entries deleted · 3 kept'));
});

test('single Delete is exact ID only, cancel performs no mutation, duplicate review taps are blocked', async () => {
  await mount({ view: 'logs', ids: ['log-one'], filters: { status: 'failed' } });
  await act(async () => { tree.update(<HistoryDeleteControl {...props({ view: 'logs', ids: ['log-one'] })} label="Delete" />); });
  let resolve: (value: unknown) => void = () => {};
  post.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
  const start = button('Delete').props.onPress;
  await act(async () => { void start(); void start(); });
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0][1]).toEqual({ view: 'logs', ids: ['log-one'] });
  await act(async () => resolve({ data: preview }));
  await press('Cancel deletion');
  expect(post).toHaveBeenCalledTimes(1);
  expect(done).not.toHaveBeenCalled();
});

test('confirmation double taps send once and retain the same token after a network error', async () => {
  await mount(); await press('Clear logs');
  let reject: (error: Error) => void = () => {};
  post.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
  const confirm = button('Confirm delete (498)').props.onPress;
  await act(async () => { void confirm(); void confirm(); });
  expect(post).toHaveBeenCalledTimes(2);
  await act(async () => reject(new Error('Connection lost. Try again.')));
  expect(text()).toContain('Connection lost. Try again.');
  expect(done).not.toHaveBeenCalled();
  post.mockResolvedValueOnce({ data: { removed: 498, retained: 0, alreadySubmitted: true, reasons: [] } });
  await press('Confirm delete (498)');
  expect(post.mock.calls[2][1]).toEqual(post.mock.calls[1][1]);
  expect(done).toHaveBeenCalledTimes(1);
});

test('changed filters invalidate a pending or completed review', async () => {
  await mount();
  let resolve: (value: unknown) => void = () => {};
  post.mockImplementationOnce(() => new Promise(value => { resolve = value; }));
  await act(async () => { void button('Clear logs').props.onPress(); });
  await act(async () => { tree.update(<HistoryDeleteControl {...props({ view: 'reports', filters: { channel: 'email' } })} />); });
  await act(async () => resolve({ data: preview }));
  expect(text()).not.toContain('Confirm delete');
  expect(done).not.toHaveBeenCalled();
  await press('Clear logs');
  const oldConfirm = button('Confirm delete (498)').props.onPress;
  await act(async () => { tree.update(<HistoryDeleteControl {...props({ view: 'reports', filters: { channel: 'whatsapp' } })} />); });
  const count = post.mock.calls.length;
  await act(async () => { await oldConfirm(); });
  expect(post).toHaveBeenCalledTimes(count);
});

test('pending-only review and malformed snapshots cannot be confirmed', async () => {
  post.mockResolvedValueOnce({ data: { ...preview, eligible: 0, retained: 500, ids: [] } });
  await mount(); await press('Clear logs');
  expect(button('Confirm delete (0)').props.disabled).toBe(true);
  await press('Confirm delete (0)');
  expect(post).toHaveBeenCalledTimes(1);
  await press('Cancel deletion');
  post.mockResolvedValueOnce({ data: { ...preview, token: '', ids: [] } });
  await press('Clear logs');
  expect(text()).toContain('Could not review these log entries.');
  expect(text()).not.toContain('Confirm delete');
});

test('server processing result keeps the same confirmation and does not claim deletion', async () => {
  await mount(); await press('Clear logs');
  post.mockResolvedValueOnce({ data: { processing: true, removed: 0, retained: 0, reasons: [] } });
  await press('Confirm delete (498)');
  expect(text()).toContain('Deletion is still being processed');
  expect(done).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
  expect(button('Confirm delete (498)')).toBeTruthy();
});

test('failed or malformed review never enables confirmation and an unclear delete result is not success', async () => {
  post.mockRejectedValueOnce(new Error('Cannot reach server'));
  await mount(); await press('Clear logs');
  expect(text()).toContain('Cannot reach server');
  expect(text()).not.toContain('Confirm delete');
  post.mockResolvedValueOnce({ data: {} });
  await press('Clear logs');
  expect(text()).toContain('Could not review these log entries.');
  await press('Clear logs');
  post.mockResolvedValueOnce({ data: {} });
  await press('Confirm delete (498)');
  expect(text()).toContain('The server did not confirm deletion.');
  expect(done).not.toHaveBeenCalled();
  expect(Alert.alert).not.toHaveBeenCalled();
});

test('API scopes automation and booking filters and preserves explicitly empty IDs', async () => {
  expect(historySelection({ view: 'logs', filters: { group: 'automation', eventId: 'ev', bookingRef: 'REF', delivery: 'failed', event: 'EVENT_BOOKING_REMINDER', search: 'name', from: '2026-10-01', to: '2026-10-17', page: 2 } })).toEqual({ view: 'logs', filters: { group: 'automation', eventId: 'ev', bookingRef: 'REF', delivery: 'failed', event: 'EVENT_BOOKING_REMINDER', search: 'name', from: '2026-10-01', to: '2026-10-17' } });
  await previewHistoryDelete({ view: 'logs', ids: [] });
  expect(post.mock.calls[0][1]).toEqual({ view: 'logs', ids: [] });
  expect(historySelection({ view: 'reports', filters: { campaignKey: 'update:one', group: 'announcement', page: 5, campaignPage: 2 } })).toEqual({ view: 'reports', filters: { campaignKey: 'update:one', group: 'announcement' } });
});

test('booking selections over500 review every supplied ID without clipping', async () => {
  const ids = Array.from({ length: 503 }, (_, i) => `log:${i}`);
  const result = await previewHistoryDelete({ view: 'logs', ids, all: true });
  expect(post.mock.calls[0][1]).toEqual({ view: 'logs', ids, all: true });
  expect(result.token).toBe(preview.token);
});

test('full clear processes over500 rows sequentially and resumes the same failed group without recounting completed groups', async () => {
  const ids = Array.from({ length: 503 }, (_, i) => `log:${i}`);
  const batches = [{ ids: ids.slice(0, 500), eligible: 500, token: 'first-reviewed-group' },
    { ids: ids.slice(500), eligible: 3, token: 'second-reviewed-group' }];
  post.mockResolvedValueOnce({ data: { ...preview, matched: 505, reviewed: 505, eligible: 503, ids, token: '', batches } });
  await mount(); await press('Clear logs');
  post.mockResolvedValueOnce({ data: { removed: 499, retained: 1, reasons: [{ count: 1, reason: 'Changed since review' }] } });
  post.mockRejectedValueOnce(new Error('Connection lost'));
  await press('Confirm delete (503)');
  expect(post.mock.calls.slice(1).map(call => call[1])).toEqual(batches.map(({ ids: batchIds, token }) => ({ ids: batchIds, token })));
  expect(text()).toContain('1 of 2 groups cleared');
  expect(text()).toContain('499 log entries deleted · 3 kept');
  expect(done).not.toHaveBeenCalled();
  await press('Close'); await press('Clear logs');
  expect(post).toHaveBeenCalledTimes(3);
  post.mockResolvedValueOnce({ data: { removed: 3, retained: 0, reasons: [], alreadySubmitted: true } });
  await press('Confirm delete (503)');
  expect(post.mock.calls[3][1]).toEqual(post.mock.calls[2][1]);
  expect(post.mock.calls.filter(call => call[0].endsWith('delete-preview'))).toHaveLength(1);
  expect(Alert.alert).toHaveBeenCalledWith('History updated', expect.stringContaining('502 log entries deleted · 3 kept'));
  expect(done).toHaveBeenCalledTimes(1);
});

test('processing waits for the same reviewed group before advancing and never counts it twice', async () => {
  const ids = Array.from({ length: 501 }, (_, i) => `log:${i}`);
  const batches = [{ ids: ids.slice(0, 500), eligible: 500, token: 'group-one' }, { ids: ids.slice(500), eligible: 1, token: 'group-two' }];
  post.mockResolvedValueOnce({ data: { ...preview, matched: 501, reviewed: 501, retained: 0, reasons: [], eligible: 501, ids, token: '', batches } });
  await mount(); await press('Clear logs');
  post.mockResolvedValueOnce({ data: { processing: true, removed: 100, retained: 0, reasons: [] } });
  await press('Confirm delete (501)');
  expect(post).toHaveBeenCalledTimes(2);
  expect(done).not.toHaveBeenCalled();
  post.mockResolvedValueOnce({ data: { removed: 500, retained: 0, reasons: [], alreadySubmitted: true } });
  post.mockResolvedValueOnce({ data: { removed: 1, retained: 0, reasons: [] } });
  await press('Confirm delete (501)');
  expect(post.mock.calls[2][1]).toEqual(post.mock.calls[1][1]);
  expect(post.mock.calls[3][1]).toEqual({ ids: batches[1].ids, token: batches[1].token });
  expect(Alert.alert).toHaveBeenCalledWith('History updated', expect.stringContaining('501 log entries deleted · 0 kept'));
  expect(done).toHaveBeenCalledTimes(1);
});

test('full clear refuses a truncated or malformed batch plan before any deletion', async () => {
  post.mockResolvedValueOnce({ data: { ...preview, remaining: 1, truncated: true } });
  await mount(); await press('Clear logs');
  expect(text()).toContain('The full history could not be reviewed');
  expect(text()).not.toContain('Confirm delete');
  post.mockResolvedValueOnce({ data: { ...preview, token: '', batches: [{ ids: preview.ids, token: 'one', eligible: 498 }, { ids: preview.ids, token: 'two', eligible: 498 }] } });
  await press('Clear logs');
  expect(text()).toContain('Could not review these log entries.');
  expect(post.mock.calls.every(call => call[0].endsWith('delete-preview'))).toBe(true);
});
