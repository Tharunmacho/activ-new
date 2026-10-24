import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { FlatList, Text, TouchableOpacity } from 'react-native';
import { ReportsPane } from '../src/screens/admin/super/delivery/ReportsPane';
import { ConsoleButton, ConsoleStatTile, ConsoleSearch } from '../src/ui';
import { ChipRow } from '../src/screens/admin/super/superKit';
import { previewHistoryDelete, confirmHistoryDelete } from '../src/services/notificationHistoryApi';
import {
  getDeliveryReport,
  previewDeliveryRetry,
  retryDeliveryReport,
  getDeliveryRetryStatus,
  notificationReason,
  statusLabel,
  type ReportFilters,
  type ReportRow,
} from '../src/services/deliveryReportApi';

jest.mock('../src/services/deliveryReportApi', () => ({
  ...jest.requireActual('../src/services/deliveryReportApi'),
  getDeliveryReport: jest.fn(),
  previewDeliveryRetry: jest.fn(),
  retryDeliveryReport: jest.fn(),
  getDeliveryRetryStatus: jest.fn(),
}));
jest.mock('../src/services/superApi', () => ({
  errorText: (error: Error) => error.message,
}));
jest.mock('../src/services/notificationHistoryApi', () => ({
  ...jest.requireActual('../src/services/notificationHistoryApi'),
  previewHistoryDelete: jest.fn(), confirmHistoryDelete: jest.fn(),
}));

const accepted = ['accepted', 'sent', 'delivered', 'read', 'marked_read'];
const rows: ReportRow[] = [
  ['whatsapp', 'read', 'Asha'],
  ['whatsapp', 'sent', 'Sent member'],
  ['whatsapp', 'delivered', 'Delivered member'],
  ['in_app', 'marked_read', 'Inbox member'],
  ['push', 'failed', 'Long member name for a narrow screen'],
  ['email', 'failed', 'Email member'],
  ...Array.from({ length: 25 }, () => ['email', 'accepted', 'Email member']),
].map(([channel, status, recipientName], index) => ({
  _id: `row-${index}`,
  channel: channel as ReportRow['channel'],
  status,
  recipientName,
  recipient: 'a-long-member-email-address@example.test',
  title: 'Regional association update',
  campaignKey: 'campaign-1',
  createdAt: '2026-10-16T10:00:00Z',
  ...(status === 'failed' ? { error: 'The device registration expired.' } : {}),
}));
const counts = (items: ReportRow[]) => ({
  records: items.length,
  accepted: items.filter(row => accepted.includes(row.status)).length,
  opened: items.filter(row => row.status === 'read').length,
  delivered: items.filter(
    row =>
      row.channel === 'whatsapp' && ['delivered', 'read'].includes(row.status),
  ).length,
  failed: items.filter(row => row.status === 'failed').length,
  queued: 0,
  skipped: 0,
  unconfirmed: items.filter(row => row.status !== 'read').length,
});
function report(filters: ReportFilters) {
  const base = rows.filter(
    row =>
      (!filters.channel || row.channel === filters.channel) &&
      (!filters.search ||
        row.recipientName.toLowerCase().includes(filters.search.toLowerCase())),
  );
  const filtered = base.filter(
    row =>
      !filters.status ||
      (filters.status === 'accepted_any'
        ? accepted.includes(row.status)
        : row.status === filters.status),
  );
  const page = filters.page || 1,
    limit = filters.limit || 25;
  return {
    summary: {
      ...counts(base),
      recipients: new Set(base.map(row => row.recipientName)).size,
    },
    channels: ['email', 'whatsapp', 'push', 'in_app'].map(_id => ({
      _id,
      ...counts(base.filter(row => row.channel === _id)),
    })),
    campaigns: [
      {
        _id: 'campaign-1',
        title: 'Regional association update',
        kind: 'announcement',
        event: '',
        createdAt: '2026-10-16T10:00:00Z',
        lastAt: '2026-10-16T10:00:00Z',
        ...counts(base),
      },
    ],
    rows: filtered.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      total: filtered.length,
      pages: Math.max(1, Math.ceil(filtered.length / limit)),
    },
    campaignPagination: { page: 1, total: 1, pages: 1 },
    generatedAt: '2026-10-16T12:00:00Z',
  };
}
let screen: Renderer.ReactTestRenderer;
let scroll: jest.SpyInstance;
const filters = () =>
  (getDeliveryReport as jest.Mock).mock.calls.at(-1)[0] as ReportFilters;
const text = () =>
  screen.root
    .findAllByType(Text)
    .map(node =>
      React.Children.toArray(node.props.children)
        .filter(child => typeof child === 'string' || typeof child === 'number')
        .join(''),
    )
    .join(' ');
const settle = async () => {
  await act(async () => {
    jest.advanceTimersByTime(350);
  });
};
const press = async (onPress: () => void) => {
  await act(async () => {
    onPress();
  });
  await settle();
};
const tile = (label: string) =>
  screen.root
    .findAllByType(ConsoleStatTile)
    .find(node => node.props.label === label)!;
const channel = (label: string) =>
  screen.root
    .findAllByType(TouchableOpacity)
    .find(
      node =>
        node.props.accessibilityLabel === `Filter delivery records by ${label}`,
    )!;
const outcome = () =>
  screen.root
    .findAllByType(ChipRow)
    .find(node =>
      node.props.options.some(
        (option: { value: string }) => option.value === 'accepted_any',
      ),
    )!;
const listRows = () =>
  screen.root.findByType(FlatList).props.data as ReportRow[];
const button = (label: string) => {
  const found = screen.root.findAllByType(ConsoleButton).find(node => node.props.label === label);
  if (!found) throw new Error(`Button not found: ${label}`);
  return found;
};
const preview = {
  matched: 2, eligible: 1, skipped: 1, ids: ['row-5'], token: 'review-fixture', truncated: false,
  reasons: [{ reason: 'This recipient has no enabled push device.', count: 1 }],
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  scroll = jest
    .spyOn(FlatList.prototype, 'scrollToOffset')
    .mockImplementation(() => {});
  (getDeliveryReport as jest.Mock).mockImplementation(
    async (input: ReportFilters) => report(input),
  );
  (previewDeliveryRetry as jest.Mock).mockResolvedValue(preview);
  (retryDeliveryReport as jest.Mock).mockResolvedValue({ attempted: 1, sent: 1, queued: 0, failed: 0, skipped: 0, reasons: [] });
  (getDeliveryRetryStatus as jest.Mock).mockResolvedValue({ found: false, processing: false });
  (previewHistoryDelete as jest.Mock).mockResolvedValue({ matched: 1, reviewed: 1, eligible: 1, retained: 0, remaining: 0, truncated: false, ids: ['row-0'], token: 'delete-review', reasons: [] });
  (confirmHistoryDelete as jest.Mock).mockResolvedValue({ removed: 1, retained: 0, reasons: [] });
});

it('report Delete reviews one exact row without resending or changing its status', async () => {
  await mount();
  const target = listRows()[0];
  await press(button('Delete').props.onPress);
  expect(previewHistoryDelete).toHaveBeenCalledWith({ view: 'reports', ids: [target._id] });
  expect(confirmHistoryDelete).not.toHaveBeenCalled();
  await press(button('Cancel deletion').props.onPress);
  expect(retryDeliveryReport).not.toHaveBeenCalled();
  expect(target.status).toBe('read');
});

it('Clear logs reviews the entire report scope and resets page after confirmed removal', async () => {
  await mount();
  await press(channel('Email').props.onPress);
  await press(() => outcome().props.onChange('accepted_any'));
  const next = screen.root.findAllByType(ConsoleButton).find(node => node.props.accessibilityLabel === 'Next people and contacts');
  if (!next) throw new Error('People pagination missing');
  await press(next.props.onPress);
  expect(filters().page).toBe(2);
  const before = { ...filters() };
  await press(button('Clear logs').props.onPress);
  expect(previewHistoryDelete).toHaveBeenCalledWith({ view: 'reports', all: true, filters: before });
  await press(button('Confirm delete (1)').props.onPress);
  expect(confirmHistoryDelete).toHaveBeenCalledWith({ ids: ['row-0'], token: 'delete-review' });
  expect(filters()).toEqual(expect.objectContaining({ channel: 'email', status: 'accepted_any', from: before.from, page: 1 }));
  expect(retryDeliveryReport).not.toHaveBeenCalled();
});

it('reviews current automation filters, confirms frozen IDs once and refreshes delivery results', async () => {
  await mount();
  const activity = screen.root.findAllByType(ChipRow).find(node => node.props.options.some((option: { value: string }) => option.value === 'automation'));
  if (!activity) throw new Error('Activity filter not found');
  await press(() => activity.props.onChange('automation'));
  await press(channel('Email').props.onPress);
  await press(() => screen.root.findByType(ConsoleSearch).props.onChangeText('Email member'));
  await press(button('Review failed deliveries').props.onPress);
  expect(previewDeliveryRetry).toHaveBeenCalledWith({ filters: expect.objectContaining({ group: 'automation', channel: 'email', search: 'Email member', status: 'failed', from: filters().from }) });
  expect(retryDeliveryReport).not.toHaveBeenCalled();
  expect(text()).toContain('2 found · 1 ready to resend · 1 not sent');
  expect(text()).toContain('No phone or browser is currently set up to receive notifications for this person.');
  expect(preview.reasons[0].reason).toBe('This recipient has no enabled push device.');
  const confirm = button('Confirm resend (1)').props.onPress;
  let complete: (value: unknown) => void = () => {};
  (retryDeliveryReport as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const readsBefore = (getDeliveryReport as jest.Mock).mock.calls.length;
  await act(async () => { confirm(); confirm(); });
  expect(retryDeliveryReport).toHaveBeenCalledTimes(1);
  expect(retryDeliveryReport).toHaveBeenCalledWith({ ids: preview.ids, token: preview.token });
  expect(button('Resending…').props.disabled).toBe(true);
  await act(async () => { complete({ attempted: 1, sent: 0, queued: 1, failed: 0, skipped: 1, reasons: [{ reason: 'Already retried', count: 1 }] }); });
  await settle();
  expect(text()).toContain('1 attempted · 0 sent · 1 waiting to send · 0 failed · 1 not sent');
  expect(text()).toContain('Resend submission');
  expect(text()).toContain('Delivery can fail later. Refresh the report for the current result.');
  expect(text()).toContain('Already retried');
  expect((getDeliveryReport as jest.Mock).mock.calls.length).toBeGreaterThan(readsBefore);
});

it.each(['push', 'whatsapp', 'email'] as const)('shows %s Resend on a collapsed failed row and cancellation performs no send', async retryChannel => {
  const target = { ...rows[4], channel: retryChannel };
  (getDeliveryReport as jest.Mock).mockResolvedValue({ ...report({}), rows: [target] });
  await mount();
  const recipient = screen.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel?.startsWith('Long member name'));
  if (!recipient) throw new Error('Failed recipient missing');
  expect(recipient.props.accessibilityState.expanded).toBe(false);
  expect(text()).not.toContain('Message history');
  await press(button('Resend').props.onPress);
  expect(previewDeliveryRetry).toHaveBeenCalledWith({ ids: ['row-4'] });
  expect(retryDeliveryReport).not.toHaveBeenCalled();
  expect(text()).toContain('Long member name for a narrow screen');
  await press(button('Cancel resend').props.onPress);
  expect(retryDeliveryReport).not.toHaveBeenCalled();
  expect(screen.root.findAllByType(ConsoleButton).some(node => node.props.label === 'Confirm resend (1)')).toBe(false);
});

it.each(['accepted', 'sent', 'delivered', 'read', 'queued', 'skipped', 'unconfirmed'])('does not offer Resend for %s messages', async status => {
  (getDeliveryReport as jest.Mock).mockResolvedValue({ ...report({}), rows: [{ ...rows[4], status }] });
  await mount();
  expect(screen.root.findAllByType(ConsoleButton).some(node => node.props.label === 'Resend')).toBe(false);
  expect(previewDeliveryRetry).not.toHaveBeenCalled();
  expect(retryDeliveryReport).not.toHaveBeenCalled();
});

it('does not offer Resend for in-app records even if an old row says failed', async () => {
  (getDeliveryReport as jest.Mock).mockResolvedValue({ ...report({}), rows: [{ ...rows[4], channel: 'in_app' }] });
  await mount();
  expect(screen.root.findAllByType(ConsoleButton).some(node => node.props.label === 'Resend')).toBe(false);
});

it('explains a historical media download failure without changing the record or sending', async () => {
  const mediaFailure = 'Media upload error: Downloading media from weblink failed with http code503, status message Service Unavailable (code131053)';
  const target = { ...rows[4], channel: 'whatsapp', error: mediaFailure };
  (getDeliveryReport as jest.Mock).mockResolvedValue({ ...report({}), rows: [target] });
  await mount();
  expect(text()).toContain('WhatsApp could not download the image or document.');
  expect(target.error).toBe(mediaFailure);
  expect(notificationReason('Media download error: failed')).toContain('WhatsApp could not download');
  expect(notificationReason('131053: unknown provider media response')).toContain('WhatsApp could not use the image or document');
  expect(notificationReason('Email attachment 131053: download took too long')).toBe('Email attachment 131053: download took too long');
  const recipient = screen.root.findAllByType(TouchableOpacity).find(node => node.props.accessibilityLabel?.startsWith('Long member name'));
  if (!recipient) throw new Error('Failed recipient missing');
  await press(recipient.props.onPress);
  expect(text()).toContain(`Service details: ${mediaFailure}`);
  expect(retryDeliveryReport).not.toHaveBeenCalled();
});

it.each([
  ['131048', 'WhatsApp has temporarily limited messages from ACTIV.'],
  ['131049', 'WhatsApp did not allow this promotional message'],
  ['131053', 'WhatsApp could not use the image or document.'],
])('explains the explicit WhatsApp wrapper for code %s without changing raw details', (code, explanation) => {
  const raw = `WhatsApp could not deliver: Provider message (code ${code})`;
  expect(notificationReason(raw)).toContain(explanation);
  expect(notificationReason(`Email could not deliver: Provider message (code ${code})`)).toBe(`Email could not deliver: Provider message (code ${code})`);
  expect(notificationReason(`Job identifier ${code}`)).toBe(`Job identifier ${code}`);
});

it('explains the unsupported WebP media failure and preserves unrelated diagnostic text', () => {
  const raw = 'Media upload error: WebP image uploads are not currently supported. (code131053)';
  expect(notificationReason(raw)).toBe('WhatsApp could not use this WebP image. Use a JPG or PNG image, then try Resend.');
  expect(notificationReason('WhatsApp could not deliver: WebP image uploads are not currently supported. (code 131053)'))
    .toBe('WhatsApp could not use this WebP image. Use a JPG or PNG image, then try Resend.');
  const unrelated = 'Email attachment: WebP image uploads are not currently supported. (code131053)';
  expect(notificationReason(unrelated)).toBe(unrelated);
});

it('keeps sent, delivered and seen distinct and preserves in-app availability', () => {
  expect(statusLabel({ channel: 'email', status: 'accepted' })).toBe('Sent');
  expect(statusLabel({ channel: 'whatsapp', status: 'sent' })).toBe('Sent');
  expect(statusLabel({ channel: 'whatsapp', status: 'delivered' })).toBe('Delivered');
  expect(statusLabel({ channel: 'push', status: 'read' })).toBe('Seen');
  expect(statusLabel({ channel: 'push', status: 'failed' })).toBe('Failed');
  expect(statusLabel({ channel: 'in_app', status: 'accepted' })).toBe('Sent');
  expect(statusLabel({ channel: 'in_app', status: 'marked_read' })).toBe('Sent');
  expect(statusLabel({ channel: 'push', status: 'queued' })).toBe('Waiting');
});

it('reviews only failed IDs on the visible page and disables page review for accepted-only rows', async () => {
  await mount();
  await press(button('Review failures on this page').props.onPress);
  expect(previewDeliveryRetry).toHaveBeenLastCalledWith({ ids: ['row-4', 'row-5'] });
  expect(text()).toContain('Failed deliveries on people page 1');
  await press(button('Cancel resend').props.onPress);
  await press(tile('Sent').props.onPress);
  expect(button('Review failures on this page').props.disabled).toBe(true);
  const reviews = (previewDeliveryRetry as jest.Mock).mock.calls.length;
  await press(button('Review failures on this page').props.onPress);
  expect(previewDeliveryRetry).toHaveBeenCalledTimes(reviews);
  expect(retryDeliveryReport).not.toHaveBeenCalled();
});

it('reaches later eligible failures when the newest 100 cannot be retried', async () => {
  const failures: ReportRow[] = Array.from({ length: 105 }, (_, index) => ({
    ...rows[5], _id: `failure-${index}`, recipientName: `Failed recipient ${index}`, status: 'failed',
  }));
  (getDeliveryReport as jest.Mock).mockImplementation(async (input: ReportFilters) => {
    const page = input.page || 1, limit = input.limit || 25;
    return { ...report(input), summary: { ...counts(failures), recipients: failures.length },
      rows: failures.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: failures.length, pages: 5 } };
  });
  (previewDeliveryRetry as jest.Mock).mockImplementation(async (selection: { ids?: string[] }) => {
    const ids = selection.ids || failures.slice(0, 100).map(row => row._id);
    const eligible = ids.filter(id => Number(id.replace('failure-', '')) >= 100);
    return { matched: selection.ids ? ids.length : failures.length, reviewed: ids.length,
      remaining: selection.ids ? 0 : 5, eligible: eligible.length, skipped: ids.length - eligible.length,
      ids: eligible, token: eligible.length ? 'later-page-review' : '', truncated: !selection.ids,
      reasons: eligible.length ? [] : [{ reason: 'Original delivery cannot be retried', count: ids.length }] };
  });
  await mount();
  await press(tile('Failed').props.onPress);
  await press(button('Review failed deliveries').props.onPress);
  expect(button('Confirm resend (0)').props.disabled).toBe(true);
  expect(text()).toContain('Batch review starts with the newest 100 failures.');
  expect(text()).toContain('use the people pages');
  expect(text()).toContain('5 still to review');
  expect(retryDeliveryReport).not.toHaveBeenCalled();
  for (let page = 2; page <= 5; page++) {
    const next = screen.root.findAllByType(ConsoleButton).find(node => node.props.accessibilityLabel === 'Next people and contacts');
    if (!next) throw new Error('Next people and contacts not found');
    await press(next.props.onPress);
  }
  expect(filters().page).toBe(5);
  const expectedIds = failures.slice(100).map(row => row._id);
  await press(button('Review failures on this page').props.onPress);
  expect(previewDeliveryRetry).toHaveBeenLastCalledWith({ ids: expectedIds });
  expect(text()).toContain('Failed deliveries on people page 5');
  (retryDeliveryReport as jest.Mock).mockResolvedValueOnce({ attempted: 5, sent: 5, queued: 0, failed: 0, skipped: 0, reasons: [] });
  await press(button('Confirm resend (5)').props.onPress);
  expect(retryDeliveryReport).toHaveBeenCalledTimes(1);
  expect(retryDeliveryReport).toHaveBeenCalledWith({ ids: expectedIds, token: 'later-page-review' });
  expect(text()).toContain('5 attempted · 5 sent');
});

it('blocks ineligible retries and discards previews after filters change', async () => {
  await mount();
  (previewDeliveryRetry as jest.Mock).mockResolvedValueOnce({ ...preview, eligible: 0, ids: [], skipped: 2 });
  await press(button('Review failed deliveries').props.onPress);
  expect(button('Confirm resend (0)').props.disabled).toBe(true);
  await press(button('Confirm resend (0)').props.onPress);
  expect(retryDeliveryReport).not.toHaveBeenCalled();
  await press(channel('Email').props.onPress);
  expect(screen.root.findAllByType(ConsoleButton).some(node => String(node.props.label).startsWith('Confirm resend'))).toBe(false);
  let complete: (value: unknown) => void = () => {};
  (previewDeliveryRetry as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  await act(async () => { button('Review failed deliveries').props.onPress(); });
  expect(button('Reviewing failures…').props.disabled).toBe(true);
  await press(channel('Email').props.onPress);
  await act(async () => { complete(preview); });
  expect(screen.root.findAllByType(ConsoleButton).some(node => String(node.props.label).startsWith('Confirm resend'))).toBe(false);
});

it('shows retry errors and reloads the report without automatically sending again', async () => {
  await mount();
  (previewDeliveryRetry as jest.Mock).mockRejectedValueOnce(new Error('Review unavailable'));
  await press(button('Review failed deliveries').props.onPress);
  expect(text()).toContain('Review unavailable');
  expect(retryDeliveryReport).not.toHaveBeenCalled();
  await press(button('Review failed deliveries').props.onPress);
  (retryDeliveryReport as jest.Mock).mockRejectedValueOnce(new Error('Confirmation expired; review again'));
  const readsBefore = (getDeliveryReport as jest.Mock).mock.calls.length;
  await press(button('Confirm resend (1)').props.onPress);
  expect(text()).toContain('Confirmation expired; review again');
  expect(retryDeliveryReport).toHaveBeenCalledTimes(1);
  expect((getDeliveryReport as jest.Mock).mock.calls.length).toBeGreaterThan(readsBefore);
});

it('recovers a timed-out confirmation through bounded status reads without another send', async () => {
  await mount();
  (previewDeliveryRetry as jest.Mock).mockResolvedValueOnce({ ...preview, statusToken: 'compact-status-fixture' });
  await press(button('Review failed deliveries').props.onPress);
  (retryDeliveryReport as jest.Mock).mockRejectedValueOnce(new Error('Network timeout'));
  (getDeliveryRetryStatus as jest.Mock)
    .mockResolvedValueOnce({ found: true, processing: true, attempted: 0, sent: 0, queued: 0, failed: 0, skipped: 0, reasons: [] })
    .mockResolvedValueOnce({ found: true, processing: false, attempted: 1, sent: 1, queued: 0, failed: 0, skipped: 0, reasons: [] });
  await press(button('Confirm resend (1)').props.onPress);
  expect(retryDeliveryReport).toHaveBeenCalledTimes(1);
  expect(getDeliveryRetryStatus).toHaveBeenCalledWith('compact-status-fixture');
  expect(retryDeliveryReport).toHaveBeenCalledWith({ ids: preview.ids, token: preview.token });
  await act(async () => { jest.advanceTimersByTime(2000); });
  await settle();
  expect(getDeliveryRetryStatus).toHaveBeenCalledTimes(2);
  expect(retryDeliveryReport).toHaveBeenCalledTimes(1);
  expect(text()).toContain('1 attempted · 1 sent · 0 waiting to send · 0 failed · 0 not sent');
  expect(text()).not.toContain('Network timeout');
});
afterEach(async () => {
  if (screen)
    await act(async () => {
      screen.unmount();
    });
  scroll.mockRestore();
  jest.useRealTimers();
});
const mount = async () => {
  await act(async () => {
    screen = Renderer.create(<ReportsPane />);
  });
  await settle();
};

it('summary cards reveal records, reset pagination and preserve activity/date/campaign filters', async () => {
  await mount();
  const from = filters().from;
  await press(
    screen.root
      .findAllByType(TouchableOpacity)
      .find(
        node =>
          node.props.accessibilityLabel ===
          'View report: Regional association update',
      )!.props.onPress,
  );
  await press(
    screen.root
      .findAllByType(ConsoleButton)
      .find(node => node.props.accessibilityLabel === 'Next people and contacts')!.props
      .onPress,
  );
  expect(filters().page).toBe(2);
  await press(tile('Sent').props.onPress);
  expect(filters()).toEqual(
    expect.objectContaining({
      status: 'accepted_any',
      page: 1,
      campaignKey: 'campaign-1',
      from,
    }),
  );
  expect(listRows().map(row => row.status)).toEqual(
    expect.arrayContaining([
      'accepted',
      'sent',
      'delivered',
      'read',
      'marked_read',
    ]),
  );
  expect(tile('Sent').props.selected).toBe(true);
  expect(scroll).toHaveBeenCalled();
  await press(() => outcome().props.onChange('accepted'));
  expect(listRows().every(row => row.status === 'accepted')).toBe(true);
  await press(tile('Seen').props.onPress);
  expect(filters().status).toBe('read');
  expect(listRows()).toHaveLength(1);
  expect(listRows()[0].recipientName).toBe('Asha');
});

it('channel cards combine with outcomes and identity cards explain repeated deliveries', async () => {
  await mount();
  await press(tile('Failed').props.onPress);
  expect(listRows()).toHaveLength(2);
  await press(channel('Email').props.onPress);
  expect(filters()).toEqual(
    expect.objectContaining({ channel: 'email', status: 'failed' }),
  );
  expect(channel('Email').props.accessibilityState.selected).toBe(true);
  expect(listRows()).toHaveLength(1);
  await press(tile('People and contacts').props.onPress);
  expect(filters()).toEqual(
    expect.objectContaining({ channel: 'email', status: '' }),
  );
  expect(listRows()).toHaveLength(25);
  expect(text()).toContain('the same account or contact can appear more than once');
  await press(channel('Email').props.onPress);
  expect(filters().channel).toBe('');
  expect(channel('Email').props.accessibilityState.selected).toBe(false);
  await press(() =>
    screen.root.findByType(ConsoleSearch).props.onChangeText('Long member'),
  );
  await press(tile('Failed').props.onPress);
  expect(filters()).toEqual(
    expect.objectContaining({ search: 'Long member', status: 'failed' }),
  );
  expect(listRows()).toHaveLength(1);
  const recipient = screen.root
    .findAllByType(TouchableOpacity)
    .find(
      node =>
        node.props.accessibilityHint ===
        'Show or hide message history and sending details',
    )!;
  await press(recipient.props.onPress);
  expect(recipient.props.accessibilityState.expanded).toBe(true);
  expect(text()).toContain('The device registration expired.');
  expect(
    screen.root
      .findAllByType(Text)
      .some(node => node.props.children === 'Message history'),
  ).toBe(true);
});
