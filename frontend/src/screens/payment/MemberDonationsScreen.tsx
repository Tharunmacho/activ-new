import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, TYPE, BRAND, money, shortDate, timeAgo,
  PremiumListPage, PremiumPageHeader, DonateHeart3D, HeaderStat, HeaderStatRow, GradientButton, SurfaceCard,
  LinkRow, GroupTitle, GradientGlyph, StateView, CardSkeletons, FadeInUp, PREMIUM_OVERLAP,
} from '../../ui';
import { fyLabel } from '../../services/paymentFlow';
import { readDonationDocs, SavedDonationDoc } from './donationStore';
import { getPendingPayment, PendingPayment } from '../../services/paymentRecovery';

/**
 * Donations — the member's way into giving and their 80G papers.
 *
 * Donors have no account on the server (website /donate): a gift is found
 * again by the unguessable receipt / statement tokens that its emailed links
 * carry. This screen lists the gifts made from THIS phone (remembered by
 * DonationResult) and opens their documents; gifts made elsewhere are opened
 * from the email, as on the website.
 */
const MemberDonationsScreen = ({ navigation }: any) => {
  const [docs, setDocs] = useState<SavedDonationDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState<PendingPayment | null>(null);

  const load = useCallback(async () => {
    try {
      const [receipts, retained] = await Promise.all([readDonationDocs(), getPendingPayment('donation')]);
      setDocs(receipts); setPending(retained);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const list = useMemo(() => docs || [], [docs]);
  const latestStatement = list.find((d) => !!d?.statementToken);
  /* Live figures from the gifts saved on this phone — never a guessed amount. */
  const known = list.filter((d) => typeof d?.amount === 'number' && Number.isFinite(d.amount));
  const total = known.length ? known.reduce((sum, d) => sum + Number(d?.amount || 0), 0) : null;

  const header = (
    <PremiumPageHeader
      onBack={() => navigation.goBack()}
      eyebrow="Support ACTIV"
      title="Donations"
      subtitle="Every gift gets its own 80G receipt; the year's gifts add up into one certificate."
      art={<DonateHeart3D size={88} />}
      artLabel="A heart held in cupped hands"
    >
      <HeaderStatRow>
        <HeaderStat icon="favorite" value={loading ? '…' : String(list.length)} label="Gifts saved" />
        <HeaderStat icon="payments" value={loading ? '…' : money(total)} label="Given here" />
      </HeaderStatRow>
      <GradientButton variant="glass" label="Donate now" icon="favorite" onPress={() => navigation.navigate('Donate')} style={{ marginTop: SPACE.md }} />
    </PremiumPageHeader>
  );

  const listHeader = (
    <FadeInUp delay={160} style={s.lift}>
      {pending ? <SurfaceCard style={s.gutter} padded={false}>
        <LinkRow icon="pending-actions" tone="amber" title="Check your recent donation" subtitle="Your payment is waiting for confirmation." onPress={() => navigation.navigate('DonationResult', { orderId: pending.orderId })} last />
      </SurfaceCard> : null}
      {latestStatement ? (
        <SurfaceCard style={s.gutter} padded={false}>
          <LinkRow
            icon="date-range"
            tone="green"
            title={`Year certificate${latestStatement.financialYear ? ` · FY ${fyLabel(latestStatement.financialYear)}` : ''}`}
            subtitle="Every gift of the financial year, totalled"
            onPress={() => navigation.navigate('DonationDocument', { kind: 'statement', token: latestStatement.statementToken, fy: latestStatement.financialYear })}
            last
          />
        </SurfaceCard>
      ) : null}
      {list.length ? <GroupTitle title="Receipts from this phone" count={list.length} /> : <View style={{ height: SPACE.md }} />}
    </FadeInUp>
  );

  return (
    <PremiumListPage<SavedDonationDoc>
      header={header}
      listHeader={loading ? <View style={s.lift}><CardSkeletons rows={3} /></View> : listHeader}
      data={loading ? [] : list}
      keyExtractor={(d, i) => String(d?.orderId || d?.receiptToken || i)}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); load(); }}
      renderItem={({ item, index }) => (
        <FadeInUp delay={Math.min(index, 6) * 60}>
          <SurfaceCard
            onPress={item?.receiptToken ? () => navigation.navigate('DonationDocument', { kind: 'receipt', token: item.receiptToken }) : undefined}
            accessibilityLabel={`Donation ${money(item?.amount)}${item?.receiptNumber ? `, receipt ${item.receiptNumber}` : ''}`}
          >
            <View style={s.row}>
              <GradientGlyph icon="receipt-long" tone="rose" size={46} />
              <View style={s.flexMin}>
                <Text style={s.amount} numberOfLines={1} maxFontSizeMultiplier={1.3}>{money(item?.amount)}</Text>
                <Text style={s.meta} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                  {[item?.receiptNumber ? `Receipt ${item.receiptNumber}` : '', shortDate(item?.savedAt)].filter(Boolean).join(' · ')}
                </Text>
                {item?.savedAt ? <Text style={s.ago} maxFontSizeMultiplier={1.3}>{timeAgo(item.savedAt)}</Text> : null}
              </View>
              <View style={s.right}>
                {item?.financialYear ? (
                  <View style={s.fy}><Text style={s.fyText} maxFontSizeMultiplier={1.2}>FY {fyLabel(item.financialYear)}</Text></View>
                ) : null}
                {item?.receiptToken ? <Icon name="chevron-right" size={22} color={PALETTE.textFaint} /> : null}
              </View>
            </View>
          </SurfaceCard>
        </FadeInUp>
      )}
      ListEmptyComponent={loading ? null : (
        <StateView
          art={<DonateHeart3D size={84} />}
          title="No donations from this phone yet"
          message="Receipts for gifts you make here appear in this list. Gifts made elsewhere are opened from the links in your receipt email."
          action="Make a donation"
          actionIcon="favorite"
          onAction={() => navigation.navigate('Donate')}
        />
      )}
      ListFooterComponent={<Text style={s.foot} maxFontSizeMultiplier={1.3}>Your receipts are also emailed to you — those links open them at any time.</Text>}
    />
  );
};

const s = StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  lift: { marginTop: -PREMIUM_OVERLAP },
  flexMin: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  amount: { fontSize: 20, lineHeight: 25, fontWeight: '900', color: BRAND.navy, fontVariant: ['tabular-nums'] },
  meta: { ...TYPE.caption, marginTop: 2 },
  ago: { ...TYPE.caption, fontSize: 11, color: PALETTE.textFaint, marginTop: 1 },
  right: { alignItems: 'flex-end', gap: 2 },
  fy: { paddingHorizontal: SPACE.sm, paddingVertical: 2, borderRadius: 999, backgroundColor: PALETTE.greenSoft },
  fyText: { fontSize: 11, lineHeight: 14, fontWeight: '800', color: PALETTE.greenDark },
  foot: { ...TYPE.caption, textAlign: 'center', marginTop: SPACE.md, marginHorizontal: SPACE.xl },
});

export default MemberDonationsScreen;
