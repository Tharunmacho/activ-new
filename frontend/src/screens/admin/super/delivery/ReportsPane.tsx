import { useLegacyAppearance } from '../../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  AccessibilityInfo,
  findNodeHandle,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE,
  SPACE,
  TYPE,
  ConsoleCard,
  ConsoleGrid,
  ConsoleStatTile,
  ConsoleNote,
  ConsoleSectionTitle,
  ConsoleSearch,
  ConsoleButton,
  PremiumInput,
  CONSOLE_LIST,
  useReduceMotion,
} from '../../../../ui';
import { ChipRow } from '../superKit';
import {
  getDeliveryReport,
  previewDeliveryRetry,
  retryDeliveryReport,
  getDeliveryRetryStatus,
  CHANNEL_LABELS,
  statusLabel,
  notificationReason,
  type DeliveryReport,
  type ReportFilters,
  type ReportRow,
  type DeliveryRetryPreview,
  type DeliveryRetryResult,
} from '../../../../services/deliveryReportApi';
import { errorText } from '../../../../services/superApi';
import { deliveryTitle, messageLabel } from './deliveryKit';
import { HistoryDeleteControl } from './HistoryDeleteControl';

const fmt = (n?: number) => Number(n || 0).toLocaleString('en-IN');
const human = (s = '') =>
  s
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/^./, c => c.toUpperCase());
const when = (s?: string) =>
  s
    ? new Date(s).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Not recorded';
const firstDate = () =>
  new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);

function Ratio({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const percent = total ? Math.round((value / total) * 1000) / 10 : 0;
  return (
    <View style={s.ratio}>
      <View style={s.between}>
        <Text style={s.caption}>{label}</Text>
        <Text style={s.caption}>
          {fmt(value)} / {fmt(total)} · {percent}%
        </Text>
      </View>
      <View style={s.track}>
        <View style={[s.progress, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

export function ReportsPane({
  header,
  refreshKey = 0,
}: {
  header?: React.ReactNode;
  refreshKey?: number;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const [filters, setFilters] = useState<ReportFilters>({
    from: firstDate(),
    page: 1,
    limit: 25,
    campaignPage: 1,
  });
  const [data, setData] = useState<DeliveryReport | null>(null),
    [busy, setBusy] = useState(true),
    [error, setError] = useState('');
  const [expanded, setExpanded] = useState(''),
    [dates, setDates] = useState(false);
  const [retryPreview, setRetryPreview] = useState<DeliveryRetryPreview | null>(null);
  const [retryResult, setRetryResult] = useState<DeliveryRetryResult | null>(null);
  const [retryBusy, setRetryBusy] = useState<'review' | 'send' | null>(null);
  const [retryError, setRetryError] = useState('');
  const [retryLabel, setRetryLabel] = useState('');
  const [retryRefresh, setRetryRefresh] = useState(0);
  const retryLock = useRef(false);
  const retrySeq = useRef(0);
  const mounted = useRef(true);
  const seq = useRef(0);
  const list = useRef<FlatList<ReportRow>>(null);
  const recipientsAnchor = useRef<View>(null);
  const recipientsOffset = useRef(0);
  const pendingReveal = useRef(false);
  const { width, fontScale } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const wideRows = width >= 768 && fontScale < 1.5;
  const revealRecipients = useCallback(() => {
    list.current?.scrollToOffset({
      offset: Math.max(0, recipientsOffset.current - SPACE.sm),
      animated: !reduceMotion,
    });
    try {
      const anchor = findNodeHandle(recipientsAnchor.current);
      if (
        anchor != null &&
        typeof AccessibilityInfo.setAccessibilityFocus === 'function'
      ) {
        AccessibilityInfo.setAccessibilityFocus(anchor);
      }
    } catch {
      /* Scrolling still reveals the section when native focus is unavailable. */
    }
  }, [reduceMotion]);
  const change = (patch: ReportFilters) => {
    setExpanded('');
    setFilters(f => ({
      ...f,
      ...patch,
      page: 1,
      ...(patch.campaignKey !== undefined || patch.group !== undefined
        ? { campaignPage: 1 }
        : {}),
    }));
  };
  const showRecipients = (patch: ReportFilters) => {
    pendingReveal.current = true;
    change(patch);
    revealRecipients();
  };
  const load = useCallback(async () => {
    const request = ++seq.current;
    setBusy(true);
    setError('');
    try {
      const report = await getDeliveryReport(filters);
      if (request === seq.current) setData(report);
    } catch (err) {
      if (request === seq.current) setError(errorText(err));
    } finally {
      if (request === seq.current) setBusy(false);
    }
  }, [filters]);
  useEffect(() => {
    const timer = setTimeout(load, 300);
    return () => {
      clearTimeout(timer);
      seq.current++;
    };
  }, [load, refreshKey, retryRefresh]);
  useEffect(() => {
    retrySeq.current++;
    setRetryPreview(null);
    setRetryError('');
  }, [filters]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; retrySeq.current++; };
  }, []);
  const reviewRetry = async (item?: ReportRow, pageOnly = false) => {
    if (retryLock.current || busy) return;
    if (item && (!item._id || item.status !== 'failed' || item.channel === 'in_app')) return;
    const pageIds = (data?.rows || []).filter(row => row?.status === 'failed' && row?._id).map(row => row._id);
    if (pageOnly && !pageIds.length) return;
    retryLock.current = true;
    const request = ++retrySeq.current;
    setRetryBusy('review');
    setRetryPreview(null);
    setRetryResult(null);
    setRetryError('');
    setRetryLabel(item ? `${item.recipientName || 'This person'} · ${CHANNEL_LABELS[item.channel]}` : pageOnly
      ? `Failed deliveries on people page ${data?.pagination?.page || 1}`
      : 'Failed deliveries for the current activity, channel, date and search filters');
    revealRecipients();
    try {
      const preview = await previewDeliveryRetry(item
        ? { ids: [item._id] }
        : pageOnly ? { ids: pageIds }
        : { filters: { ...filters, status: 'failed' } });
      if (mounted.current && request === retrySeq.current) setRetryPreview(preview);
    } catch (err) {
      if (mounted.current && request === retrySeq.current) setRetryError(errorText(err));
    } finally {
      retryLock.current = false;
      if (mounted.current) setRetryBusy(null);
    }
  };
  const confirmRetry = async () => {
    if (retryLock.current || !retryPreview?.eligible || !retryPreview.token || !retryPreview.ids?.length) return;
    retryLock.current = true;
    setRetryBusy('send');
    setRetryError('');
    const statusToken = retryPreview.statusToken || retryPreview.token;
    const recover = async () => {
      let status = await getDeliveryRetryStatus(statusToken);
      for (let attempt = 1; status?.processing && attempt < 5 && mounted.current; attempt++) {
        await new Promise<void>(resolve => setTimeout(resolve, 2000));
        if (!mounted.current) break;
        status = await getDeliveryRetryStatus(statusToken);
      }
      return status;
    };
    try {
      const result = await retryDeliveryReport({ ids: retryPreview.ids, token: retryPreview.token });
      const finalResult = result?.processing && mounted.current ? await recover().catch(() => result) : result;
      if (mounted.current) setRetryResult(finalResult);
    } catch (err) {
      let recovered = false;
      if (!(err as { response?: unknown })?.response && mounted.current) {
        try {
          const status = await recover();
          if (mounted.current && status?.found) { setRetryResult(status); recovered = true; }
        } catch { /* Keep the original request error when status is unavailable. */ }
      }
      if (mounted.current && !recovered) setRetryError(errorText(err));
    } finally {
      retryLock.current = false;
      if (mounted.current) {
        setRetryPreview(null);
        setRetryBusy(null);
        setRetryRefresh(value => value + 1);
      }
    }
  };
  useEffect(() => {
    if (!busy && pendingReveal.current) {
      pendingReveal.current = false;
      revealRecipients();
    }
  }, [busy, data, revealRecipients]);
  const summary = data?.summary;
  const selected = data?.campaigns.find(c => c._id === filters.campaignKey);
  const historyChanged = () => {
    setExpanded('');
    setFilters(value => ({ ...value, page: 1, campaignPage: 1 }));
  };
  const top = (
    <>
      {header}
      <ConsoleSectionTitle
        title="Delivery reports"
        subtitle="Updates and automatic messages"
        icon="insights"
      />
      <ChipRow<string>
        options={[
          { value: '', label: 'All activity' },
          { value: 'publication', label: 'Published updates' },
          { value: 'automation', label: 'Automatic messages' },
        ]}
        value={filters.group || ''}
        onChange={group => change({ group, campaignKey: '' })}
      />
      <ChipRow<string>
        options={[
          { value: '', label: 'All channels' },
          ...Object.entries(CHANNEL_LABELS).map(([value, label]) => ({
            value,
            label,
          })),
        ]}
        value={filters.channel || ''}
        onChange={channel => change({ channel })}
      />
      <ConsoleButton
        label={dates ? 'Hide dates' : `Dates · ${filters.from || 'All time'}`}
        icon="date-range"
        onPress={() => setDates(!dates)}
      />
      {dates && (
        <ConsoleCard style={s.card}>
          <PremiumInput
            tone="admin"
            label="From date (IST)"
            placeholder="YYYY-MM-DD"
            value={filters.from || ''}
            onChangeText={from => change({ from })}
            accessibilityLabel="Report from date"
          />
          <PremiumInput
            tone="admin"
            label="To date (IST)"
            placeholder="YYYY-MM-DD"
            value={filters.to || ''}
            onChangeText={to => change({ to })}
            accessibilityLabel="Report to date"
          />
        </ConsoleCard>
      )}
      <ConsoleNote
        kind="indigo"
        text="Each email, WhatsApp message or notification is counted separately. Sent means it was passed to the sending service; arrival is not confirmed. Delivered means arrival was confirmed. Seen means an open or tap was recorded. For in-app updates, Sent means saved in the account; it does not confirm they were seen. No recorded open does not always mean unread."
        style={s.card}
      />
      {error ? <ConsoleNote kind="red" text={error} style={s.card} /> : null}
      <ConsoleGrid style={s.card}>
        <ConsoleStatTile
          label="People and contacts"
          value={fmt(summary?.recipients)}
          icon="people-outline"
          hint="Counted by account, email or phone"
          selected={!filters.status}
          onPress={() => showRecipients({ status: '' })}
        />
        <ConsoleStatTile
          label="Sent"
          value={fmt(summary?.accepted)}
          icon="send"
          hint={`${fmt(summary?.records)} delivery records`}
          accent="green"
          selected={filters.status === 'accepted_any'}
          onPress={() => showRecipients({ status: 'accepted_any' })}
        />
        <ConsoleStatTile
          label="Seen"
          value={fmt(summary?.opened)}
          icon="visibility"
          hint="WhatsApp reads and taps"
          accent="sky"
          selected={filters.status === 'read'}
          onPress={() => showRecipients({ status: 'read' })}
        />
        <ConsoleStatTile
          label="Failed"
          value={fmt(summary?.failed)}
          icon="error-outline"
          hint={`${fmt(summary?.queued)} waiting to send · ${fmt(
            summary?.skipped,
          )} not sent`}
          accent="red"
          selected={filters.status === 'failed'}
          onPress={() => showRecipients({ status: 'failed' })}
        />
      </ConsoleGrid>
      {Object.entries(CHANNEL_LABELS).map(([key, label]) => {
        const channel = data?.channels.find(c => c._id === key);
        return (
          <TouchableOpacity
            key={key}
            accessibilityRole="button"
            accessibilityLabel={`Filter delivery records by ${label}`}
            accessibilityState={{ selected: filters.channel === key }}
            accessibilityHint={
              filters.channel === key
                ? 'Show all channels and view people and messages'
                : 'View people and messages for this channel'
            }
            onPress={() =>
              showRecipients({ channel: filters.channel === key ? '' : key })
            }
          >
            <ConsoleCard
              style={s.card}
              accent={filters.channel === key ? PALETTE.indigo : undefined}
            >
              <Text style={s.title}>{label}</Text>
              <Ratio
                label="Sent"
                value={channel?.accepted || 0}
                total={channel?.records || 0}
              />
              {key === 'whatsapp' && (
                <Ratio
                  label="Delivered"
                  value={channel?.delivered || 0}
                  total={channel?.records || 0}
                />
              )}
              {key !== 'email' ? (
                <Ratio
                  label={
                    key === 'push'
                      ? 'Seen / sent'
                      : key === 'whatsapp'
                      ? 'Seen / delivered'
                      : 'Seen'
                  }
                  value={channel?.opened || 0}
                  total={
                    (key === 'whatsapp'
                      ? channel?.delivered
                      : key === 'push'
                      ? channel?.accepted
                      : channel?.records) || 0
                  }
                />
              ) : (
                <Text style={s.caption}>
                  We cannot tell whether an email reached the inbox or was opened.
                </Text>
              )}
              <Text style={s.caption}>
                {fmt(channel?.failed)} failed · {fmt(channel?.queued)} waiting to send ·{' '}
                {fmt(channel?.skipped)} not sent
              </Text>
              <View style={s.between}>
                <Text style={s.link}>
                  {filters.channel === key
                    ? 'Selected · Show all channels'
                    : 'View people and messages'}
                </Text>
                <Icon name="arrow-forward" size={18} color={PALETTE.indigo} />
              </View>
            </ConsoleCard>
          </TouchableOpacity>
        );
      })}
      <ConsoleSectionTitle
        title={
          filters.campaignKey ? 'Selected report' : 'Updates & automatic messages'
        }
        icon="campaign"
      />
      {filters.campaignKey ? (
        <ConsoleCard style={s.card}>
          <Text style={s.title}>{selected?.title || 'Selected report'}</Text>
          {selected && (
            <Text style={s.caption}>
              {human(selected.kind)} · {when(selected.createdAt)}
              {selected.currentAudience
                ? ` · Current audience: ${human(selected.currentAudience)}`
                : ''}
            </Text>
          )}
          {selected?.publicationStatuses?.some(state => state !== 'done') && (
            <Text style={s.caption}>
              Preparing messages:{' '}
              {selected.publicationStatuses
                .filter(Boolean)
                .map(state => state === 'queued' ? 'Waiting to send' : human(state))
                .join(', ')}
              . Counts grow as messages are prepared for people who match your choices.
            </Text>
          )}
          {selected?.publicationErrors?.filter(Boolean).map((reason, i) => (
            <Text key={i} style={s.error}>
              {notificationReason(reason)}
            </Text>
          ))}
          <ConsoleButton
            label="All reports"
            icon="arrow-back"
            onPress={() => change({ campaignKey: '' })}
          />
        </ConsoleCard>
      ) : (
        <>
          {data?.campaigns.map(c => (
            <TouchableOpacity
              key={c._id}
              onPress={() =>
                change({ campaignKey: c._id, status: '', search: '' })
              }
              accessibilityRole="button"
              accessibilityLabel={`View report: ${c.title}`}
            >
              <ConsoleCard style={s.card}>
                <Text style={s.eyebrow}>
                  {human(c.kind === 'automation' ? c.event : c.kind)}
                </Text>
                <Text style={s.title}>
                  {c.kind === 'automation' ? messageLabel(c.event) : c.title}
                </Text>
                <Text style={s.caption}>{when(c.lastAt)}</Text>
                <Text style={s.caption}>
                  {fmt(c.records)} deliveries · {fmt(c.opened)} seen ·{' '}
                  {fmt(c.failed)} failed · {fmt(c.queued)} waiting to send
                </Text>
              </ConsoleCard>
            </TouchableOpacity>
          ))}
          {(data?.campaignPagination.pages || 0) > 1 && (
            <View style={s.pages}>
              <ConsoleButton
                label="Previous"
                disabled={busy || data?.campaignPagination.page === 1}
                onPress={() =>
                  setFilters(f => ({
                    ...f,
                    campaignPage: Math.max(1, (f.campaignPage || 1) - 1),
                  }))
                }
              />
              <Text style={s.caption}>
                {data?.campaignPagination.page} /{' '}
                {data?.campaignPagination.pages}
              </Text>
              <ConsoleButton
                label="Next"
                disabled={
                  busy ||
                  data?.campaignPagination.page ===
                    data?.campaignPagination.pages
                }
                onPress={() =>
                  setFilters(f => ({
                    ...f,
                    campaignPage: (f.campaignPage || 1) + 1,
                  }))
                }
              />
            </View>
          )}
        </>
      )}
      <View
        ref={recipientsAnchor}
        accessible
        accessibilityRole="header"
        accessibilityLabel="People and messages"
        onLayout={event => {
          recipientsOffset.current = event.nativeEvent.layout.y;
        }}
      >
        <ConsoleSectionTitle title="People and messages" icon="people-outline" />
      </View>
      <ConsoleCard style={s.card}>
        <Text style={s.body} accessibilityLiveRegion="polite">
          {filters.channel
            ? CHANNEL_LABELS[filters.channel as keyof typeof CHANNEL_LABELS]
            : 'All channels'}
          {' · '}
          {filters.status === 'accepted_any'
            ? 'Sent, including delivered or seen messages'
            : filters.status === 'read'
            ? 'Seen'
            : filters.status
            ? statusLabel({ channel: filters.channel === 'in_app' ? 'in_app' : 'email', status: filters.status })
            : 'Every outcome'}
          {busy ? ' · Updating records…' : ''}
        </Text>
        <Text style={s.caption}>
          {fmt(summary?.recipients)} people and contacts across{' '}
          {fmt(summary?.records)} messages for the current activity,
          channel, date and search filters. Each row is one message, so
          the same account or contact can appear more than once. Tap a row for its
          history and sending details.
        </Text>
      </ConsoleCard>
      <ConsoleSearch
        value={filters.search || ''}
        onChangeText={search => change({ search })}
        placeholder="Name, email, phone or booking reference"
      />
      <ChipRow<string>
        options={[
          { value: '', label: 'All outcomes' },
          { value: 'unconfirmed', label: 'No recorded open' },
          { value: 'read', label: 'Seen' },
          { value: 'accepted_any', label: 'Sent' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'marked_read', label: 'Marked read' },
          { value: 'failed', label: 'Failed' },
          { value: 'queued', label: 'Waiting' },
          { value: 'skipped', label: 'Not sent' },
          { value: 'mock', label: 'Not sent — setup needed' },
        ]}
        value={filters.status || ''}
        onChange={status => change({ status })}
      />
      <View style={s.card}><HistoryDeleteControl selection={{ view: 'reports', all: true, filters: { ...filters } }}
        disabled={busy || !!retryBusy} onDone={historyChanged} /></View>
      <ConsoleNote
        kind="indigo"
        text="Review failed messages before sending again. Only messages that can still be sent are included. No recorded open does not mean delivery failed."
        style={s.card}
      />
      <ConsoleButton label={retryBusy === 'review' ? 'Reviewing failures…' : 'Review failed deliveries'}
        disabled={busy || !!retryBusy || !summary?.failed} onPress={() => void reviewRetry()} />
      <ConsoleButton label="Review failures on this page" accessibilityLabel="Review failed deliveries on this page"
        kind="soft" style={s.card} disabled={busy || !!retryBusy || !(data?.rows || []).some(row => row?.status === 'failed')}
        onPress={() => void reviewRetry(undefined, true)} />
      {retryBusy === 'send' && <ConsoleNote kind="indigo" text="Resending the reviewed deliveries…" style={s.card} />}
      {!!retryError && <ConsoleNote kind="red" text={notificationReason(retryError)} style={s.card} />}
      {retryPreview && <ConsoleCard style={s.card}>
        <Text style={s.title} accessibilityRole="header">Confirm resend</Text>
        <Text style={s.body}>{retryLabel}</Text>
        <Text style={s.body}>{fmt(retryPreview.matched)} found · {fmt(retryPreview.eligible)} ready to resend · {fmt(retryPreview.skipped)} not sent</Text>
        {(retryPreview.reasons || []).map((reason, index) => <Text key={index} style={s.caption}>{fmt(reason.count)} not sent: {notificationReason(reason.reason)}</Text>)}
        {retryPreview.truncated && <Text style={s.body}>{fmt(retryPreview.reviewed ?? (retryPreview.eligible + retryPreview.skipped))} reviewed, {fmt(retryPreview.remaining ?? Math.max(0, retryPreview.matched - retryPreview.eligible - retryPreview.skipped))} still to review. Batch review starts with the newest 100 failures. Select Failed, use the people pages, then choose “Review failures on this page” for later deliveries.</Text>}
        <Text style={s.caption}>Only these reviewed messages will be sent again. We check again that each message can still be sent.</Text>
        <View style={s.retryActions}>
          <ConsoleButton label={retryBusy === 'send' ? 'Resending…' : `Confirm resend (${fmt(retryPreview.eligible)})`}
            disabled={!!retryBusy || !retryPreview.eligible || !retryPreview.ids?.length || !retryPreview.token}
            onPress={() => void confirmRetry()} />
          <ConsoleButton label="Cancel resend" kind="soft" disabled={!!retryBusy} onPress={() => setRetryPreview(null)} />
        </View>
      </ConsoleCard>}
      {retryResult && <ConsoleCard style={s.card}>
        <Text style={s.title} accessibilityRole="header">Resend submission</Text>
        {retryResult.processing ? <Text style={s.body} accessibilityLiveRegion="polite">This resend is already processing. Refresh the report to see delivery progress.</Text> : <Text style={s.body} accessibilityLiveRegion="polite">{fmt(retryResult.attempted)} attempted · {fmt(retryResult.sent)} sent · {fmt(retryResult.queued)} waiting to send · {fmt(retryResult.failed)} failed · {fmt(retryResult.skipped)} not sent</Text>}
        <Text style={s.caption}>These counts show the initial resend submission. Delivery can fail later. Refresh the report for the current result. In-app updates are saved in the account. Waiting includes messages waiting or still being sent.</Text>
        {(retryResult.reasons || []).map((reason, index) => <Text key={index} style={s.caption}>{fmt(reason.count)} messages: {notificationReason(reason.reason)}</Text>)}
      </ConsoleCard>}
    </>
  );
  const row = ({ item }: { item: ReportRow }) => (
    <ConsoleCard style={s.card}>
      <TouchableOpacity
        onPress={() => setExpanded(expanded === item._id ? '' : item._id)}
        accessibilityRole="button"
        accessibilityState={{ expanded: expanded === item._id }}
        accessibilityLabel={`${item.recipientName}, ${
          CHANNEL_LABELS[item.channel]
        }, ${deliveryTitle(item)}, ${statusLabel(item)}`}
        accessibilityHint="Show or hide message history and sending details"
      >
        <View style={[s.recipientRow, wideRows && s.wideRow]}>
          <View style={[s.recipientColumn, wideRows && s.flex]}>
            <Text style={s.title}>{item.recipientName}</Text>
            <Text style={s.caption}>
              {item.recipient || 'ACTIV account / device'}
            </Text>
          </View>
          <View style={[s.recipientColumn, wideRows && s.flex]}>
            <Text style={s.body}>{CHANNEL_LABELS[item.channel]}</Text>
            <Text style={s.caption}>{deliveryTitle(item)}</Text>
            <Text style={s.caption}>{when(item.createdAt)}</Text>
          </View>
          <View style={[s.outcome, wideRows && s.wideOutcome]}>
            <Text
              style={[
                s.status,
                item.status === 'failed'
                  ? s.failedStatus
                  : ['read', 'delivered'].includes(item.status)
                  ? s.readStatus
                  : s.acceptedStatus,
              ]}
            >
              {statusLabel(item)}
            </Text>
            <Icon
              name={expanded === item._id ? 'expand-less' : 'expand-more'}
              size={20}
              color={PALETTE.textMuted}
            />
          </View>
        </View>
      </TouchableOpacity>
      {item.status === 'failed' && item.channel !== 'in_app' && !!item._id && (
        <View style={s.retryActions}>
          {!!item.error && expanded !== item._id && <Text style={s.error}>{notificationReason(item.error)}</Text>}
          <ConsoleButton label="Resend" icon="replay" kind="soft"
            accessibilityLabel={`Resend ${CHANNEL_LABELS[item.channel]} to ${item.recipientName || 'this person'}`}
            disabled={busy || !!retryBusy} onPress={() => void reviewRetry(item)} />
        </View>
      )}
      {!!item._id && <View style={s.retryActions}><HistoryDeleteControl label="Delete"
        selection={{ view: 'reports', ids: [item._id] }} disabled={busy || !!retryBusy} onDone={historyChanged} /></View>}
      {expanded === item._id && (
        <View style={s.detail}>
          <Text style={s.title}>Message history</Text>
          <Text style={s.caption}>
            {[item.region?.state, item.region?.district, item.region?.block]
              .filter(Boolean)
              .join(' / ') || 'Region not recorded'}
          </Text>
          <Text style={s.body}>
            Sending service: {item.provider || 'Not recorded'} · Attempts:{' '}
            {fmt(item.attempts)}
          </Text>
          {item.templateId && (
            <Text style={s.body}>Template: {item.templateId}</Text>
          )}
          {item.bookingRef && (
            <Text style={s.body}>Booking: {item.bookingRef}</Text>
          )}
          {item.error && (
            <Text style={item.status === 'failed' ? s.error : s.body}>
              {notificationReason(item.error)}
            </Text>
          )}
          {item.error && notificationReason(item.error) !== item.error && (
            <Text style={s.caption} selectable>Service details: {item.error}</Text>
          )}
          {item.history?.map((event, i) => (
            <Text key={i} style={s.body}>
              {event.status === 'marked_read' ? 'Marked read' : statusLabel({ channel: item.channel, status: event.status })}: {when(event.at)}
              {event.detail ? ` · ${notificationReason(event.detail)}` : ''}
            </Text>
          ))}
          {item.deliveredAt && (
            <Text style={s.body}>Delivered: {when(item.deliveredAt)}</Text>
          )}
          {item.openedAt && (
            <Text style={s.body}>Seen: {when(item.openedAt)}</Text>
          )}
          {item.readAt && (
            <Text style={s.body}>Marked read: {when(item.readAt)}</Text>
          )}
          {item.status === 'queued' && item.nextAttemptAt && (
            <Text style={s.body}>Next attempt: {when(item.nextAttemptAt)}</Text>
          )}
          <Text style={s.caption}>
            Email acceptance means the mail server accepted the message; inbox delivery
            and opens are not confirmed. A notification is counted as seen only when someone taps it.
          </Text>
        </View>
      )}
    </ConsoleCard>
  );
  return (
    <FlatList
      ref={list}
      data={data?.rows || []}
      renderItem={row}
      keyExtractor={(item, index) => String(item?._id || index)}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      ListHeaderComponent={top}
      contentContainerStyle={CONSOLE_LIST}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={busy}
          onRefresh={load}
          tintColor={PALETTE.indigo}
        />
      }
      ListEmptyComponent={
        !busy ? (
          <Text style={s.empty}>No people or contacts match these filters.</Text>
        ) : null
      }
      ListFooterComponent={
        <View>
          <Text style={s.caption}>
            {fmt(data?.pagination.total)} delivery records
          </Text>
          <View style={s.pages}>
            <ConsoleButton
              label="Previous"
              accessibilityLabel="Previous people and contacts"
              disabled={busy || (data?.pagination.page || 1) <= 1}
              onPress={() =>
                setFilters(f => ({
                  ...f,
                  page: Math.max(1, (f.page || 1) - 1),
                }))
              }
            />
            <Text style={s.caption}>
              {data?.pagination.page || 1} / {data?.pagination.pages || 1}
            </Text>
            <ConsoleButton
              label="Next"
              accessibilityLabel="Next people and contacts"
              disabled={
                busy ||
                (data?.pagination.page || 1) >= (data?.pagination.pages || 1)
              }
              onPress={() =>
                setFilters(f => ({ ...f, page: (f.page || 1) + 1 }))
              }
            />
          </View>
        </View>
      }
    />
  );
}
const s = StyleSheet.create({
  card: { marginBottom: SPACE.md },
  retryActions: { gap: SPACE.sm, marginTop: SPACE.sm },
  title: {
    ...TYPE.body,
    fontWeight: '700',
    color: PALETTE.text,
    marginBottom: SPACE.xs,
  },
  body: { ...TYPE.small, color: PALETTE.text, marginBottom: SPACE.xs },
  caption: {
    ...TYPE.caption,
    color: PALETTE.textMuted,
    marginBottom: SPACE.xs,
  },
  eyebrow: {
    ...TYPE.caption,
    color: PALETTE.indigo,
    fontWeight: '700',
    marginBottom: SPACE.xs,
  },
  error: { ...TYPE.small, color: PALETTE.redDark },
  flex: { flex: 1 },
  recipientRow: { gap: SPACE.sm },
  wideRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  recipientColumn: { minWidth: 0 },
  outcome: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACE.sm,
  },
  wideOutcome: { width: 176 },
  status: {
    ...TYPE.caption,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
    paddingHorizontal: SPACE.sm,
    paddingVertical: SPACE.xs,
    borderRadius: SPACE.md,
    overflow: 'hidden',
  },
  failedStatus: { color: PALETTE.redDark, backgroundColor: PALETTE.redSoft },
  readStatus: { color: PALETTE.greenDark, backgroundColor: PALETTE.greenSoft },
  acceptedStatus: {
    color: PALETTE.indigoDark,
    backgroundColor: PALETTE.indigoSoft,
  },
  link: {
    ...TYPE.caption,
    color: PALETTE.indigo,
    fontWeight: '700',
    flexShrink: 1,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
  },
  ratio: { marginVertical: SPACE.sm },
  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: PALETTE.divider,
    overflow: 'hidden',
  },
  progress: { height: 5, backgroundColor: PALETTE.blue },
  pages: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACE.sm,
    marginVertical: SPACE.md,
  },
  detail: {
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
    marginTop: SPACE.md,
    paddingTop: SPACE.md,
  },
  empty: {
    ...TYPE.body,
    textAlign: 'center',
    color: PALETTE.textMuted,
    padding: SPACE.xl,
  },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;
