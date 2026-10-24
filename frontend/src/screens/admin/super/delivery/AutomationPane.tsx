import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleCard, ConsoleSkeleton, ConsoleState, ConsoleNote, ConsoleSearch, ConsoleButton, CONSOLE_LIST,
} from '../../../../ui';
import {
  getAutomationLogs, EMPTY_AUTOMATION, getDeliveryGuardHealth, retryAllFailed,
  type AutomationPage, type DeliveryCounts, type DeliveryLogRow, type DeliveryGuardHealth, type RetryAllSummary,
} from '../../../../services/notificationDeliveryApi';
import { errorText } from '../../../../services/superApi';
import { ChipRow } from '../superKit';
import { InlineSelect, DateField } from '../events/eventKit';
import {
  DeliveryBadge, DeliveryDetail, ResendButton, MESSAGE_TYPES, STATE_META,
  channelColor, channelIcon, channelWord, messageLabel, plainReason, stateOf, whenLabel,
} from './deliveryKit';

/**
 * ============================================================================
 * NOTIFICATIONS → AUTOMATION (website NotificationsAutomation.tsx)
 * ============================================================================
 *
 * Every message the platform sent on its own — booking confirmations,
 * reminders, documents, cancellations, membership messages — and where each
 * one got to: accepted by the provider, delivered, read, or failed and why.
 *
 *   GET  /notifications/logs?group=automation&page&limit=25&eventId&channel
 *        &delivery&event&from&to&search    (search only at ≥ 2 characters)
 *   POST /notifications/retry/:id          Resend, confirmed inline
 *
 * The counts are for the FILTERED set, so narrowing to one event answers "how
 * many of this event's confirmations failed". Any filter change returns to
 * page one; requests are debounced 300 ms. Tap a message for its full detail
 * (template, provider id, timeline, reason) — expanded in place, no Modal.
 */

import { HistoryDeleteControl } from './HistoryDeleteControl';

const PAGE_SIZE = 25;

const TYPE_LABELS = MESSAGE_TYPES.map(([, l]) => l);
const typeFromLabel = (label: string) => (MESSAGE_TYPES.find(([, l]) => l === label) || [''])[0];

/**
 * THREE NUMBERS — Sent, Failed, Not sent — each one tap to filter the list
 * (the website's tiles; they replace two grids of five figures each).
 */
function Tiles({ email, whatsapp, delivery, onPick }: {
  email: DeliveryCounts; whatsapp: DeliveryCounts; delivery: string; onPick: (value: string) => void;
}) {
  const num = (v: unknown) => Number(v || 0);
  const reached = (c: DeliveryCounts) => num(c?.accepted) + num(c?.sent) + num(c?.delivered) + num(c?.read);
  const tiles: [string, string, number, string, string][] = [
    ['reached', 'Sent', reached(email) + reached(whatsapp), `WhatsApp ${reached(whatsapp)} · Email ${reached(email)}`, PALETTE.greenDark],
    ['failed', 'Failed', num(email?.failed) + num(whatsapp?.failed), `WhatsApp ${num(whatsapp?.failed)} · Email ${num(email?.failed)}`, PALETTE.redDark],
    ['mock', 'Not sent', num(email?.mock) + num(whatsapp?.mock), 'Email/WhatsApp off', PALETTE.textSoft],
  ];
  return (
    <View style={s.tiles}>
      {tiles.map(([value, label, count, hint, color]) => {
        const on = delivery === value;
        return (
          <TouchableOpacity
            key={value}
            style={[s.tile, on ? { borderColor: color } : null]}
            onPress={() => onPick(on ? '' : value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${label}: ${count}. ${hint}`}
          >
            <Text style={s.cellLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label.toUpperCase()}</Text>
            <Text style={[s.cellValue, { color }]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}>{count}</Text>
            <Text style={s.cellHint} numberOfLines={2} maxFontSizeMultiplier={1.2}>{hint}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MessageCard({ row, open, onToggle, onChanged }: { row: DeliveryLogRow; open: boolean; onToggle: () => void; onChanged: () => void }) {
  const state = stateOf(row);
  const reason = plainReason(row);
  return (
    <ConsoleCard
      style={s.card}
      accent={state === 'failed' ? PALETTE.red : undefined}
      onPress={onToggle}
      accessibilityLabel={`${messageLabel(row?.event)} to ${row?.recipientName || row?.recipient || 'unknown'}, ${channelWord(row?.channel)}, ${(STATE_META[state] || STATE_META.queued).label}`}
    >
      <View style={s.row}>
        <View style={[s.chan, { backgroundColor: row?.channel === 'whatsapp' ? PALETTE.greenSoft : PALETTE.blueSoft }]}>
          <Icon name={channelIcon(row?.channel)} size={18} color={channelColor(row?.channel)} />
        </View>
        <View style={s.flexText}>
          <Text style={s.title} numberOfLines={2} maxFontSizeMultiplier={1.3}>{row?.recipientName || row?.recipient || '—'}</Text>
          {row?.recipientName && row?.recipient ? <Text style={s.sub} numberOfLines={1} maxFontSizeMultiplier={1.3}>{row.recipient}</Text> : null}
          <Text style={s.msg} numberOfLines={2} maxFontSizeMultiplier={1.3}>{messageLabel(row?.event)}</Text>
        </View>
        <DeliveryBadge state={state} />
      </View>
      <View style={s.metaRow}>
        {row?.eventTitle ? (
          <View style={s.meta}>
            <Icon name="event" size={14} color={PALETTE.textMuted} />
            <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{row.eventTitle}</Text>
          </View>
        ) : null}
        {row?.bookingRef ? (
          <View style={s.meta}>
            <Icon name="confirmation-number" size={14} color={PALETTE.textMuted} />
            <Text style={[s.metaText, s.mono]} numberOfLines={1} maxFontSizeMultiplier={1.3}>{row.bookingRef}</Text>
          </View>
        ) : null}
        <View style={s.meta}>
          <Icon name="schedule" size={14} color={PALETTE.textMuted} />
          <Text style={s.metaText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{whenLabel(row?.createdAt) || '—'}</Text>
        </View>
      </View>
      {reason.text && !open ? (
        <Text style={[s.reason, reason.failed ? null : s.reasonOk]} numberOfLines={2} maxFontSizeMultiplier={1.3}>{reason.text}</Text>
      ) : null}
      {!!row?._id && <HistoryDeleteControl label="Delete" selection={{ view: 'logs', ids: [row._id] }} onDone={onChanged} />}
      {open ? (
        <View style={s.detail}>
          <DeliveryDetail row={row} />
          <View style={s.resend}><ResendButton row={row} onDone={onChanged} /></View>
        </View>
      ) : (
        <View style={s.footRow}>
          {state === 'failed' ? <ResendButton row={row} onDone={onChanged} compact /> : <View />}
          <View style={s.moreRow}>
            <Text style={s.more} maxFontSizeMultiplier={1.2}>Details</Text>
            <Icon name="expand-more" size={18} color={PALETTE.indigo} />
          </View>
        </View>
      )}
    </ConsoleCard>
  );
}

export function AutomationPane({ header, refreshKey = 0 }: { header?: React.ReactElement | null; refreshKey?: number }) {
  const [data, setData] = useState<AutomationPage>(EMPTY_AUTOMATION);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [eventId, setEventId] = useState('');
  const [channel, setChannel] = useState('');
  const [delivery, setDelivery] = useState('');
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState('');
  const [showDates, setShowDates] = useState(false);
  const seq = useRef(0);

  /* Is email going out? (deliveryGuard) — and "Retry all failed", confirmed inline. */
  const [health, setHealth] = useState<DeliveryGuardHealth | null>(null);
  const [retryAsk, setRetryAsk] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryResult, setRetryResult] = useState<RetryAllSummary | null>(null);

  useEffect(() => {
    let alive = true;
    getDeliveryGuardHealth(refreshKey > 0)
      .then((h) => { if (alive) setHealth(h); })
      .catch(() => { if (alive) setHealth(null); });
    return () => { alive = false; };
  }, [refreshKey]);

  const load = useCallback(async (mode: 'load' | 'refresh' | 'quiet' = 'load') => {
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'load') setLoading(true);
    setError('');
    try {
      const term = (search || '').trim();
      const result = await getAutomationLogs({
        page, limit: PAGE_SIZE, eventId, channel, delivery, event: type, from, to,
        search: term.length >= 2 ? term : '',
      });
      if (mine === seq.current) { setData(result); setLoaded(true); }
    } catch (err) {
      if (mine === seq.current) setError(errorText(err, 'The automation log could not be loaded'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [page, eventId, channel, delivery, type, from, to, search]);

  // Debounced, so typing into the search box does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => { load('load'); }, 300);
    return () => clearTimeout(timer);
  }, [load, refreshKey]);

  // Any filter change starts again at page one.
  useEffect(() => { setPage(1); }, [eventId, channel, delivery, type, from, to, search]);

  const rows = useMemo(() => (Array.isArray(data?.logs) ? data.logs : []), [data]);
  const pg = data?.pagination || EMPTY_AUTOMATION.pagination;
  const filtered = !!(eventId || channel || delivery || type || from || to || (search || '').trim());

  const events = useMemo(() => (Array.isArray(data?.events) ? data.events : []), [data]);
  const eventLabels = useMemo(() => events.map((ev) => `${ev?.title || 'Untitled event'} (${Number(ev?.count || 0)})`), [events]);
  const eventLabel = useMemo(() => {
    const i = events.findIndex((ev) => String(ev?.eventId || '') === eventId);
    return i >= 0 ? eventLabels[i] : '';
  }, [events, eventLabels, eventId]);

  const runRetryAll = async () => {
    setRetrying(true);
    setRetryResult(null);
    try {
      const summary = await retryAllFailed(168);
      setRetryResult(summary);
      getDeliveryGuardHealth().then(setHealth).catch(() => null);
      load('quiet');
    } catch (err) {
      setError(errorText(err, 'The failed messages could not be retried'));
    } finally {
      setRetrying(false);
      setRetryAsk(false);
    }
  };

  const failedCount = Number(data?.counts?.byChannel?.email?.failed || 0) + Number(data?.counts?.byChannel?.whatsapp?.failed || 0);

  const clearAll = () => {
    setEventId(''); setChannel(''); setDelivery(''); setType(''); setFrom(''); setTo(''); setSearch('');
  };

  const showing = pg.total
    ? `Showing ${(pg.page - 1) * pg.limit + 1} to ${Math.min(pg.page * pg.limit, pg.total)} of ${pg.total}`
    : 'No entries';

  const renderItem = useCallback(({ item }: { item: DeliveryLogRow }) => (
    <MessageCard
      row={item}
      open={openId === String(item?._id || '')}
      onToggle={() => setOpenId((cur) => (cur === String(item?._id || '') ? '' : String(item?._id || '')))}
      onChanged={() => { setOpenId(''); if (page !== 1) setPage(1); else void load('quiet'); }}
    />
  ), [openId, load, page]);

  const listHeader = (
    <>
      {header || null}
      <View style={s.selects}><HistoryDeleteControl
        selection={{ view: 'logs', all: true, filters: { group: 'automation', eventId, channel, delivery, event: type, from, to,
          search: search.trim().length >= 2 ? search.trim() : '' } }} disabled={loading}
        onDone={() => { setOpenId(''); if (page !== 1) setPage(1); else void load('quiet'); }} /></View>
      {health?.email?.ok === false ? (
        <ConsoleNote
          style={s.note}
          kind="red"
          icon="error-outline"
          text={`Email is not being sent right now — ${health.email.configured === false ? 'no email server is set up' : `the mail server refused the login${health.email.error ? ` (${health.email.error})` : ''}`}. Correct EMAIL_HOST / EMAIL_USER / EMAIL_PASS on the server; failed emails go out automatically once it works.`}
        />
      ) : health?.email?.ok ? (
        <Text style={s.healthOk} maxFontSizeMultiplier={1.3}>
          ✓ Email server connected{health.autoRetry?.enabled ? ` · failures retried automatically every ${health.autoRetry.everyMinutes} min` : ''}
        </Text>
      ) : null}

      {loaded ? (
        <Tiles email={data.counts.byChannel.email} whatsapp={data.counts.byChannel.whatsapp} delivery={delivery} onPick={setDelivery} />
      ) : null}

      {failedCount > 0 || retryResult ? (
        <ConsoleCard style={s.card}>
          <Text style={s.retryText} maxFontSizeMultiplier={1.3}>
            {retryResult
              ? `Tried again: ${retryResult.retried}: ${retryResult.sent} sent${retryResult.stillFailed ? `, ${retryResult.stillFailed} still failing` : ''}${retryResult.permanent ? `, ${retryResult.permanent} require recipient or sending service review before retrying` : ''}${retryResult.waitingForEmail ? `, ${retryResult.waitingForEmail} waiting for the email server` : ''}.`
              : 'Send failed messages from the last 7 days again, where another attempt may work.'}
          </Text>
          {retryAsk ? (
            <View style={s.retryRow}>
              <Text style={s.retryAsk} maxFontSizeMultiplier={1.3}>Message these people again?</Text>
              <ConsoleButton size="sm" icon="send" label={retrying ? 'Sending…' : 'Yes, send'} disabled={retrying} onPress={runRetryAll} />
              <ConsoleButton size="sm" kind="soft" label="Cancel" disabled={retrying} onPress={() => setRetryAsk(false)} />
            </View>
          ) : (
            <View style={s.retryRow}>
              <ConsoleButton size="sm" kind="soft" icon="refresh" label="Send failed messages again" onPress={() => setRetryAsk(true)} />
            </View>
          )}
        </ConsoleCard>
      ) : null}

      <ConsoleSearch value={search} onChangeText={setSearch} placeholder="Search name, phone, email or booking ID" />
      <ChipRow<string>
        value={channel}
        onChange={setChannel}
        options={[{ value: '', label: 'Both' }, { value: 'whatsapp', label: 'WhatsApp' }, { value: 'email', label: 'Email' }]}
      />
      <TouchableOpacity
        onPress={() => setShowDates((v) => !v)}
        style={s.datesToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: showDates }}
        accessibilityLabel="More filters"
      >
        <Icon name="tune" size={18} color={PALETTE.indigo} />
        <Text style={s.datesText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {showDates ? 'Fewer filters' : 'More filters (event, message, dates)'}
        </Text>
        <Icon name={showDates ? 'expand-less' : 'expand-more'} size={20} color={PALETTE.indigo} />
      </TouchableOpacity>
      {showDates ? (
        <View style={s.selects}>
          <InlineSelect
            label="Event"
            value={eventLabel}
            options={eventLabels}
            placeholder="All events"
            emptyLabel="All events"
            onChange={(label) => {
              const i = eventLabels.indexOf(label);
              setEventId(i >= 0 ? String(events[i]?.eventId || '') : '');
            }}
          />
          <InlineSelect
            label="Message"
            value={type ? messageLabel(type) : ''}
            options={TYPE_LABELS}
            placeholder="All messages"
            emptyLabel="All messages"
            onChange={(label) => setType(label ? typeFromLabel(label) : '')}
          />
          <DateField label="From date" value={from} onChange={setFrom} />
          <DateField label="To date" value={to} onChange={setTo} min={from || undefined} />
        </View>
      ) : null}
      {filtered ? (
        <View style={s.clearRow}>
          <Text style={s.showing} maxFontSizeMultiplier={1.3}>{loading ? 'Filtering…' : `${Number(pg.total || 0)} messages`}</Text>
          <ConsoleButton size="sm" kind="soft" icon="close" label="Clear" onPress={clearAll} />
        </View>
      ) : null}

      {error && loaded ? <ConsoleNote style={s.note} kind="red" icon="error-outline" text={error} /> : null}
      {error && !loaded ? <ConsoleState kind="error" title="Could not load the automation log" message={error} action="Try again" onAction={() => load('load')} /> : null}
      {loading && !refreshing ? <ConsoleSkeleton rows={3} style={s.skeleton} /> : null}
    </>
  );

  const pager = !loading && rows.length ? (
    <View style={s.pager}>
      <Text style={s.showing} maxFontSizeMultiplier={1.3}>{showing}</Text>
      {pg.pages > 1 ? (
        <View style={s.pagerRow}>
          <ConsoleButton size="sm" kind="soft" icon="chevron-left" label="Previous" disabled={pg.page <= 1 || loading}
            onPress={() => setPage((p) => Math.max(1, p - 1))} accessibilityLabel="Previous page" />
          <Text style={s.pageNo} maxFontSizeMultiplier={1.2}>{pg.page} / {pg.pages}</Text>
          <ConsoleButton size="sm" kind="soft" icon="chevron-right" label="Next" disabled={pg.page >= pg.pages || loading}
            onPress={() => setPage((p) => Math.min(pg.pages, p + 1))} accessibilityLabel="Next page" />
        </View>
      ) : null}
    </View>
  ) : null;

  return (
    <FlatList
      data={loading && !refreshing ? [] : rows}
      keyExtractor={(item, index) => String(item?._id || index)}
      renderItem={renderItem}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      contentContainerStyle={CONSOLE_LIST}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={!loading && !(error && !loaded) ? (
        <ConsoleState
          title={filtered ? 'No messages match' : 'Nothing automated yet'}
          message={filtered ? 'No messages match those filters.' : 'No automated messages have been sent yet.'}
          action={filtered ? 'Clear filters' : undefined}
          onAction={filtered ? clearAll : undefined}
        />
      ) : null}
      ListFooterComponent={pager}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    />
  );
}

const s = StyleSheet.create({
  flexText: { flex: 1, minWidth: 0 },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.md, marginBottom: SPACE.md },
  section: { marginTop: SPACE.sm },
  skeleton: { marginTop: SPACE.md },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  tiles: { flexDirection: 'row', gap: SPACE.sm, marginHorizontal: SPACE.lg, marginTop: SPACE.md, marginBottom: SPACE.md },
  tile: {
    flex: 1, minWidth: 0, backgroundColor: PALETTE.canvasAdmin, borderRadius: 14, borderWidth: 1.5,
    borderColor: 'transparent', paddingHorizontal: SPACE.sm, paddingVertical: SPACE.sm,
  },
  clearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACE.lg, marginTop: SPACE.md },
  reasonOk: { color: PALETTE.textMuted },
  healthOk: { marginHorizontal: SPACE.lg, marginTop: SPACE.md, fontSize: 13, fontWeight: '700', color: PALETTE.greenDark },
  retryText: { fontSize: 13, lineHeight: 19, color: PALETTE.textSoft },
  retryRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm },
  retryAsk: { fontSize: 13, fontWeight: '800', color: PALETTE.textSoft },
  cellLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.6, color: PALETTE.textMuted },
  cellValue: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  cellHint: { fontSize: 10, lineHeight: 13, color: PALETTE.textFaint, marginTop: 2 },
  selects: { paddingHorizontal: SPACE.lg, marginTop: SPACE.md },
  datesToggle: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginHorizontal: SPACE.lg, marginTop: SPACE.md,
    paddingHorizontal: SPACE.md, minHeight: 44, borderRadius: 14, backgroundColor: PALETTE.indigoSoft,
  },
  datesText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '700', color: PALETTE.indigoDark },
  dates: { paddingHorizontal: SPACE.lg, marginTop: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  chan: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPE.subheading, fontWeight: '800' },
  sub: { ...TYPE.caption, marginTop: 1 },
  msg: { fontSize: 13, fontWeight: '700', color: PALETTE.indigoDark, marginTop: SPACE.xs },
  metaRow: { marginTop: SPACE.sm, gap: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  metaText: { ...TYPE.caption, flex: 1, minWidth: 0 },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  reason: { fontSize: 12, lineHeight: 17, color: PALETTE.redDark, marginTop: SPACE.sm },
  detail: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  resend: { marginTop: SPACE.md },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACE.sm, gap: SPACE.sm },
  moreRow: { flexDirection: 'row', alignItems: 'center' },
  more: { fontSize: 12, fontWeight: '800', color: PALETTE.indigo },
  pager: { paddingHorizontal: SPACE.lg, marginTop: SPACE.sm, gap: SPACE.sm },
  showing: { ...TYPE.caption },
  pagerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm },
  pageNo: { fontSize: 14, fontWeight: '800', color: PALETTE.textSoft },
});
