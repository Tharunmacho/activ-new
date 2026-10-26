import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import {
  PALETTE, SPACE, TYPE, money, shortDate,
  ConsoleScroll, ConsoleHeader, ConsoleGrid, ConsoleStatTile, ConsoleCard, ConsoleChip, ConsoleSectionTitle,
  ConsoleSkeleton, ConsoleState, GlassIconButton, consoleStageKind,
} from '../../../ui';
import { getDonor, resendDonationReceipt, fyLabel, statementUrl, receiptUrl, errorText } from '../../../services/superApi';
import { MiniAction, openUrl, callNumber } from './superKit';

/**
 * ============================================================================
 * SUPER ADMIN — one donor (website /super-admin/donations/:id)
 * ============================================================================
 *
 * GET /admin/super/donations/donors/:id — the donor, their totals per
 * financial year (each has its own year certificate), and EVERY donation as
 * its own row (receipt, date, amount, status, message in full). "Resend"
 * re-emails the 80G receipt: POST /admin/super/donations/:id/resend.
 */

const GOLD = PALETTE.amberDark;

/** Absent values are left out rather than printed as dashes (website `Detail`). */
function Detail({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const v = String(value || '').trim();
  if (!v) return null;
  return (
    <View style={[s.detail, !last && s.divider]}>
      <Text style={s.detailLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Text style={s.detailValue} selectable maxFontSizeMultiplier={1.3}>{v}</Text>
    </View>
  );
}

const SuperDonorDetailScreen: React.FC = () => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const id: string = String(route?.params?.id || '');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState('');
  const loadedOnce = useRef(false);

  const load = useCallback(async (mode: 'load' | 'refresh' | 'quiet' = 'load') => {
    if (!id) { setLoading(false); setError('No donor was chosen.'); return; }
    if (mode === 'refresh') setRefreshing(true); else if (mode === 'load') setLoading(true);
    setError('');
    try { setData(await getDonor(id)); } catch (err) { setError(errorText(err, 'The donor could not be loaded')); } finally { setLoading(false); setRefreshing(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { load(loadedOnce.current ? 'quiet' : 'load'); loadedOnce.current = true; }, [load]));

  const resend = async (donationId: string) => {
    if (!donationId) return;
    setSending(donationId);
    try {
      await resendDonationReceipt(donationId);
      Alert.alert('Sent', 'Receipt sent to the donor again.');
    } catch (err) {
      Alert.alert('Could not resend the receipt', errorText(err));
    } finally {
      setSending('');
    }
  };

  const title = String(route?.params?.name || 'Donor');
  const d = data?.donor || {};
  const byYear: any[] = Array.isArray(data?.byYear) ? data.byYear : [];
  const donations: any[] = Array.isArray(data?.donations) ? data.donations : [];
  const allTime = byYear.reduce((sum, y) => sum + Number(y?.total || 0), 0);
  const paidCount = donations.filter((x) => String(x?.status || '').toLowerCase() === 'paid').length;
  const addr = d?.address || {};
  const org = d?.donorType === 'organisation';

  const header = (
    <ConsoleHeader
      compact
      eyebrow={org ? 'Super Admin · organisation donor' : 'Super Admin · donor'}
      title={d?.fullName || title}
      subtitle={d?.email || 'Every gift, receipt and year certificate for this donor.'}
      left={<GlassIconButton icon="arrow-back" accessibilityLabel="Back" onPress={() => navigation?.goBack?.()} />}
      right={d?.phone ? <GlassIconButton icon="call" accessibilityLabel="Call the donor" onPress={() => callNumber(d.phone)} /> : undefined}
    />
  );

  if (loading && !data) {
    return <ConsoleScroll>{header}<ConsoleSkeleton variant="tiles" style={s.overlap} /><ConsoleSkeleton rows={2} /></ConsoleScroll>;
  }
  if (error && !data) {
    return <ConsoleScroll>{header}<ConsoleState kind="error" title="Could not load this donor" message={error} action="Try again" onAction={() => load('load')} /></ConsoleScroll>;
  }

  return (
    <ConsoleScroll refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load('refresh')} tintColor={PALETTE.indigo} />}>
      {header}
      <ConsoleGrid overlap>
        <ConsoleStatTile label="All time" value={money(allTime)} icon="volunteer-activism" accent="gold" hint={`${byYear.length} financial year${byYear.length === 1 ? '' : 's'}`} />
        <ConsoleStatTile label="Completed gifts" value={paidCount} icon="receipt-long" accent="green" hint={`${donations.length} recorded`} delay={60} />
      </ConsoleGrid>

      <ConsoleCard style={s.card}>
        <Text style={s.cardTitle} maxFontSizeMultiplier={1.3}>Donor details</Text>
        <Detail label={org ? 'Organisation' : 'Name'} value={d?.fullName} />
        <Detail label="Email" value={d?.email} />
        <Detail label="Mobile" value={d?.phone} />
        <Detail label="PAN" value={d?.pan} />
        <Detail label="Address" value={addr?.line1} />
        <Detail label="City" value={addr?.city} />
        <Detail label="District" value={addr?.district} />
        <Detail label="State" value={addr?.state} />
        <Detail label="PIN code" value={addr?.pincode} last />
        {d?.phone ? <View style={s.actions}><MiniAction icon="call" label="Call" onPress={() => callNumber(d.phone)} /></View> : null}
      </ConsoleCard>

      <ConsoleSectionTitle title="By financial year" icon="event-note" style={s.section} />
      {byYear.length === 0 ? <ConsoleState title="No completed donations yet" /> : byYear.map((y, i) => {
        const count = Number(y?.count || 0);
        return (
          <ConsoleCard key={String(y?.financialYear || i)} style={s.card}>
            <View style={s.row}>
              <View style={s.flexText}>
                <Text style={s.name} maxFontSizeMultiplier={1.3}>FY {fyLabel(y?.financialYear)}</Text>
                <Text style={s.sub} maxFontSizeMultiplier={1.3}>{count} gift{count === 1 ? '' : 's'}</Text>
              </View>
              <Text style={s.amount} numberOfLines={1} maxFontSizeMultiplier={1.2}>{money(y?.total)}</Text>
            </View>
            {d?.statementToken ? (
              <View style={s.actions}>
                <MiniAction icon="event-note" label="Year certificate" color={GOLD} onPress={() => openUrl(statementUrl(d.statementToken, y?.financialYear))} />
              </View>
            ) : null}
          </ConsoleCard>
        );
      })}

      <ConsoleSectionTitle title="Every donation" icon="receipt-long" style={s.section} />
      {donations.length === 0 ? <ConsoleState title="No donations recorded" /> : donations.map((r, i) => {
        const status = String(r?.status || 'pending');
        const paid = status.toLowerCase() === 'paid';
        const rid = String(r?.id || '');
        return (
          <ConsoleCard key={rid || String(i)} style={s.card} accent={paid ? PALETTE.green : undefined}>
            <View style={s.row}>
              <View style={s.flexText}>
                <Text style={s.name} numberOfLines={1} maxFontSizeMultiplier={1.3}>{r?.receiptNumber || 'No receipt yet'}</Text>
                <Text style={s.sub} maxFontSizeMultiplier={1.3}>
                  {shortDate(r?.paidAt || r?.createdAt) || '—'}{r?.financialYear ? ` · FY ${fyLabel(r.financialYear)}` : ''}{r?.paymentMode ? ` · ${r.paymentMode}` : ''}
                </Text>
              </View>
              <View style={s.right}>
                <Text style={s.amount} numberOfLines={1} maxFontSizeMultiplier={1.2}>{money(r?.amount)}</Text>
                <ConsoleChip label={status} kind={paid ? 'approved' : consoleStageKind(status)} style={s.chipTop} />
              </View>
            </View>
            {r?.message ? <Text style={s.message} maxFontSizeMultiplier={1.3}>“{r.message}”</Text> : null}
            {paid ? (
              <View style={s.actions}>
                {r?.receiptToken ? <MiniAction icon="receipt-long" label="Receipt" color={GOLD} onPress={() => openUrl(receiptUrl(r.receiptToken))} /> : null}
                <MiniAction icon="send" label={sending === rid ? 'Sending…' : 'Resend'} onPress={() => resend(rid)} disabled={!!sending} />
              </View>
            ) : null}
          </ConsoleCard>
        );
      })}
    </ConsoleScroll>
  );
};

const s = StyleSheet.create({
  overlap: { marginTop: -30 },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  cardTitle: { ...TYPE.subheading, fontWeight: '800', marginBottom: SPACE.xs },
  section: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg, marginBottom: SPACE.md },
  detail: { paddingVertical: SPACE.sm },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  detailLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: PALETTE.textFaint, textTransform: 'uppercase' },
  detailValue: { fontSize: 14, lineHeight: 20, color: PALETTE.text, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  flexText: { flex: 1, minWidth: 0 },
  right: { alignItems: 'flex-end', maxWidth: '45%' },
  name: { ...TYPE.subheading, fontWeight: '800' },
  sub: { ...TYPE.caption, marginTop: 2 },
  amount: { fontSize: 17, fontWeight: '800', color: GOLD },
  chipTop: { marginTop: SPACE.xs },
  message: { fontSize: 13, color: PALETTE.textSoft, fontStyle: 'italic', marginTop: SPACE.sm, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: SPACE.sm, marginTop: SPACE.md },
});

export default SuperDonorDetailScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
