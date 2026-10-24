import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE,
  ConsoleFrame, ConsoleHeader, ConsoleCard, ConsoleSkeleton, ConsoleState, ConsoleNote, GlassIconButton, CONSOLE_LIST,
} from '../../../ui';
import { getBookingDelivery, type BookingDelivery, type DeliveryLogRow } from '../../../services/notificationDeliveryApi';
import { errorText } from '../../../services/superApi';
import { HistoryDeleteControl } from './delivery/HistoryDeleteControl';
import {
  DeliveryBadge, DeliveryDetail, ResendButton, STATE_META, channelColor, channelIcon, channelWord, messageLabel, reasonOf, stateOf, whenLabel,
} from './delivery/deliveryKit';

/**
 * ============================================================================
 * SUPER ADMIN — Messages for one booking (website BookingDeliveryPanel)
 * ============================================================================
 *
 *   GET  /notifications/logs/booking/:ref   every automated message about this
 *        booking — to the booker, each participant and each event document —
 *        with its status, reason and timeline.
 *   POST /notifications/retry/:id           Resend (confirmed inline).
 *
 * A stack screen rather than the website's side panel (Rule 2: no native
 * Modal inside the admin area). Tap a message to expand its detail in place.
 */

export default function SuperBookingMessagesScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const bookingRef: string = String(route?.params?.bookingRef || '');
  const title: string = String(route?.params?.title || '');

  const [data, setData] = useState<BookingDelivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState('');
  const seq = useRef(0);

  const load = useCallback(async (mode: 'first' | 'refresh' | 'quiet' = 'first') => {
    if (!bookingRef) { setLoading(false); return; }
    const mine = ++seq.current;
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'first') setLoading(true);
    setError('');
    try {
      const d = await getBookingDelivery(bookingRef);
      if (mine === seq.current) setData(d);
    } catch (err) {
      if (mine === seq.current) setError(errorText(err, 'The message history could not be loaded'));
    } finally {
      if (mine === seq.current) { setLoading(false); setRefreshing(false); }
    }
  }, [bookingRef]);

  useEffect(() => { load('first'); }, [load]);

  const rows: DeliveryLogRow[] = Array.isArray(data?.rows) ? data.rows : [];
  const historyCleanup = useMemo(() => {
    const items: DeliveryLogRow[] = Array.isArray(data?.rows) ? data.rows : [];
    return {
      pending: items.filter(row => stateOf(row) === 'queued').length,
    };
  }, [data?.rows]);

  const renderItem = useCallback(({ item }: { item: DeliveryLogRow }) => {
    const open = openId === item?._id;
    const reason = reasonOf(item);
    return (
      <ConsoleCard
        style={s.card}
        accent={stateOf(item) === 'failed' ? PALETTE.red : undefined}
        onPress={() => setOpenId(open ? '' : String(item?._id || ''))}
        accessibilityLabel={`${messageLabel(item?.event)}, ${channelWord(item?.channel)}, ${(STATE_META[stateOf(item)] || STATE_META.queued).label}`}
      >
        <View style={s.row}>
          <View style={[s.chan, { backgroundColor: item?.channel === 'whatsapp' ? PALETTE.greenSoft : PALETTE.blueSoft }]}>
            <Icon name={channelIcon(item?.channel)} size={18} color={channelColor(item?.channel)} />
          </View>
          <View style={s.flexText}>
            <Text style={s.title} maxFontSizeMultiplier={1.3}>{messageLabel(item?.event)}</Text>
            <Text style={s.sub} maxFontSizeMultiplier={1.3}>
              {[item?.recipientName, item?.recipient].filter(Boolean).join(' · ')}{item?.createdAt ? ` · ${whenLabel(item.createdAt)}` : ''}
            </Text>
            {reason ? <Text style={s.reason} numberOfLines={open ? undefined : 2} maxFontSizeMultiplier={1.3}>{reason}</Text> : null}
          </View>
          <DeliveryBadge state={stateOf(item)} />
        </View>
        {!!item?._id && <HistoryDeleteControl label="Delete" selection={{ view: 'logs', ids: [item._id] }}
          onDone={() => { setOpenId(''); void load('quiet'); }} />}
        {open ? (
          <View style={s.detail}>
            <DeliveryDetail row={item} />
            <View style={s.resend}><ResendButton row={item} onDone={() => load('quiet')} /></View>
          </View>
        ) : (
          <View style={s.moreRow}>
            <Text style={s.more} maxFontSizeMultiplier={1.2}>Details & resend</Text>
            <Icon name="expand-more" size={18} color={PALETTE.indigo} />
          </View>
        )}
      </ConsoleCard>
    );
  }, [openId, load]);

  const summary = (['email', 'whatsapp'] as const).map((ch) => {
    const sm = data?.summary?.[ch];
    return (
      <View key={ch} style={s.sumCell}>
        <View style={s.sumHead}>
          <Icon name={channelIcon(ch)} size={16} color={channelColor(ch)} />
          <Text style={s.sumTitle} maxFontSizeMultiplier={1.3}>{channelWord(ch)}</Text>
        </View>
        {sm ? <DeliveryBadge state={String(sm?.status || '')} /> : <Text style={s.none} maxFontSizeMultiplier={1.3}>Nothing sent</Text>}
        {sm?.reason ? <Text style={s.sumReason} numberOfLines={3} maxFontSizeMultiplier={1.3}>{reasonOf({ failureReason: sm.reason })}</Text> : null}
      </View>
    );
  });

  const header = (
    <>
      <ConsoleHeader
        compact
        eyebrow="Super Admin · booking"
        title="Messages for this booking"
        subtitle={[bookingRef, title].filter(Boolean).join(' · ') || undefined}
        left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
        right={<GlassIconButton icon="refresh" accessibilityLabel="Refresh" onPress={() => load('refresh')} />}
      />
      {!loading && !error && rows.length ? <View style={s.sumRow}>{summary}</View> : null}
      {!!rows.length && <View style={s.note}>
        {!!historyCleanup.pending && <Text style={s.sub}>{historyCleanup.pending} messages waiting to send will stay in this history.</Text>}
        <HistoryDeleteControl label="Clear logs"
          selection={{ view: 'logs', all: true, filters: { bookingRef } }} disabled={loading || !!error || !bookingRef}
          onDone={() => { setOpenId(''); void load('quiet'); }} />
      </View>}
      {error ? <ConsoleState kind="error" title="Could not load the messages" message={error} action="Try again" onAction={() => load('first')} /> : null}
      {loading && !error ? <ConsoleSkeleton rows={3} style={s.skeleton} /> : null}
    </>
  );

  return (
    <ConsoleFrame>
      <FlatList
        data={loading || error ? [] : rows}
        keyExtractor={(item, index) => String(item?._id || index)}
        renderItem={renderItem}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        contentContainerStyle={CONSOLE_LIST}
        ListHeaderComponent={header}
        ListEmptyComponent={!loading && !error ? (
          <ConsoleState
            title={bookingRef ? 'No messages yet' : 'No booking chosen'}
            message={bookingRef ? 'No email or WhatsApp message has been recorded for this booking.' : 'Open a booking to see its messages.'}
          />
        ) : null}
        ListFooterComponent={!loading && !error && rows.length ? (
          <ConsoleNote
            style={s.note}
            icon="check-circle-outline"
            text="Resend rebuilds the message from the booking as it stands now and sends it only to that recipient, on that channel."
          />
        ) : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}
        showsVerticalScrollIndicator={false}
      />
    </ConsoleFrame>
  );
}

const s = StyleSheet.create({
  flexText: { flex: 1, minWidth: 0 },
  skeleton: { marginTop: SPACE.md },
  sumRow: { flexDirection: 'row', gap: SPACE.md, paddingHorizontal: SPACE.lg, marginTop: -SPACE.lg, marginBottom: SPACE.md },
  sumCell: {
    flex: 1, minWidth: 0, backgroundColor: PALETTE.card, borderRadius: 18, padding: SPACE.md, gap: SPACE.xs,
    borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', alignItems: 'flex-start',
  },
  sumHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  sumTitle: { ...TYPE.subheading, fontWeight: '800' },
  sumReason: { fontSize: 12, lineHeight: 16, color: PALETTE.redDark },
  none: { ...TYPE.caption },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  chan: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { ...TYPE.subheading, fontWeight: '800' },
  sub: { ...TYPE.caption, marginTop: 2 },
  reason: { fontSize: 12, lineHeight: 17, color: PALETTE.redDark, marginTop: SPACE.xs },
  detail: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  resend: { marginTop: SPACE.md },
  moreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: SPACE.sm },
  more: { fontSize: 12, fontWeight: '800', color: PALETTE.indigo },
  note: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm },
});
