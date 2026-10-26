import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Share, Alert } from 'react-native';
import {
  Notice, BottomActionBar, FilterChips, Skeleton, SPACE, asArray, errorText,
  PremiumPage, PremiumPageHeader, CertificateSeal3D, GlassIconButton, GradientButton, SurfaceCard, StateView,
  PillTabs, HeaderStat, HeaderStatRow,
} from '../../ui';
import { Overlap } from './paymentUi';

import { getDonationReceipt, getDonationStatement, fyLabel } from '../../services/paymentFlow';
import { TaxCertificateView, certRupees } from '../member/certificates/CertificateViews';
import { saveCertificatePdf } from '../../services/certificateExport';

/**
 * A donor's 80G documents — website `pages/donate/DonationDocumentPage.tsx`.
 *
 *   kind 'receipt'    GET /donations/receipt/:token          one gift
 *   kind 'statement'  GET /donations/statement/:token?fy=    the year, totalled
 *
 * Both are drawn as the association's Tax Exemption certificate, fed with the
 * donation's data exactly as the website maps it (receiptToCertificate /
 * statementToCertificate). The statement carries a year switcher when there
 * is more than one year, and the "Provisional" stamp while the year runs.
 */

const SITE = 'https://activ.org.in';

const modeLabel = (m?: string) => {
  const v = String(m || '').toLowerCase();
  if (v === 'mock') return 'Test';
  if (v === 'online' || !v) return 'Online';
  return v.charAt(0).toUpperCase() + v.slice(1);
};

const blankMember = (name: string, pan: string) => ({ name, membershipNumber: '', email: '', block: '', district: '', state: '', pan });

const receiptToCertificate = (d: any) => ({
  kind: 'tax-exemption',
  member: blankMember(String(d?.donor?.fullName || ''), String(d?.donor?.pan || '')),
  financialYear: String(d?.financialYear || ''),
  contribution: {
    amount: typeof d?.amount === 'number' ? d.amount : null,
    reference: String(d?.receiptNumber || ''),
    receivedOn: d?.paidAt || null,
    payments: [{ date: d?.paidAt || null, amount: typeof d?.amount === 'number' ? d.amount : null, mode: modeLabel(d?.paymentMode), reference: String(d?.receiptNumber || '') }],
  },
  reference: String(d?.receiptNumber || ''),
  issuedAt: d?.paidAt || new Date().toISOString(),
});

const statementToCertificate = (d: any) => {
  const rows = asArray<any>(d?.donations).map((g) => ({
    date: g?.paidAt || null,
    amount: typeof g?.amount === 'number' ? g.amount : null,
    mode: modeLabel(g?.paymentMode),
    reference: String(g?.receiptNumber || ''),
  }));
  return {
    kind: 'tax-exemption',
    member: blankMember(String(d?.donor?.fullName || ''), String(d?.donor?.pan || '')),
    financialYear: String(d?.financialYear || ''),
    contribution: {
      amount: typeof d?.total === 'number' ? d.total : null,
      reference: String(d?.statementNumber || ''),
      receivedOn: rows.length ? rows[rows.length - 1].date : null,
      payments: rows,
    },
    reference: String(d?.statementNumber || ''),
    issuedAt: d?.generatedAt || new Date().toISOString(),
  };
};

const DonationDocumentScreen = ({ navigation, route }: any) => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const kind: 'receipt' | 'statement' = route?.params?.kind === 'statement' ? 'statement' : 'receipt';
  const token = String(route?.params?.token || '');
  const [fy, setFy] = useState(String(route?.params?.fy || ''));
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const pdfRef = useRef<View>(null);
  const [savingPdf, setSavingPdf] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = kind === 'statement' ? await getDonationStatement(token, fy || undefined) : await getDonationReceipt(token);
      if (!alive.current) return;
      const valid = kind === 'statement' ? !!d?.financialYear : !!d?.receiptNumber;
      if (valid) setData(d);
      else { setData(null); setError(kind === 'statement' ? 'This certificate link is not valid.' : 'This receipt link is not valid.'); }
    } catch (err) {
      if (alive.current) { setData(null); setError(errorText(err, kind === 'statement' ? 'This certificate could not be loaded.' : 'This receipt could not be loaded.')); }
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [kind, token, fy]);

  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);

  const cert = useMemo(() => (data ? (kind === 'statement' ? statementToCertificate(data) : receiptToCertificate(data)) : null), [data, kind]);
  const years = asArray<string>(data?.availableYears);

  const downloadPdf = async () => {
    if (!cert || savingPdf) return;
    setSavingPdf(true);
    try {
      const saved = await saveCertificatePdf(pdfRef.current, `ACTIV-${cert.reference || kind}.pdf`);
      if (saved) Alert.alert('PDF saved', 'Your document has been saved in Downloads on this device.');
    } catch (err) {
      Alert.alert('PDF could not be saved', errorText(err, 'Please try again.'));
    } finally {
      if (alive.current) setSavingPdf(false);
    }
  };

  /* The same three sheet props feed the page here and the full-screen zoom. */
  const sheetProps = {
    receiptColumn: kind === 'statement',
    amountInWords: String((kind === 'statement' ? data?.totalInWords : data?.amountInWords) || ''),
    stamp: kind === 'statement'
      ? (data?.isFinal === false
        ? `Provisional — FY ${fyLabel(data?.financialYear)} in progress · final after 31 March`
        : `Consolidated certificate · FY ${fyLabel(data?.financialYear)}`)
      : '',
  };
  const openZoom = () => {
    if (!cert) return;
    try {
      navigation.navigate('CertificateZoom', { cert, ...sheetProps });
    } catch (err) {
      console.warn('Certificate zoom navigation safely caught:', err);
    }
  };

  const share = async () => {
    if (!data) return;
    const link = kind === 'statement'
      ? `${SITE}/donate/statement/${encodeURIComponent(token)}${data?.financialYear ? `?fy=${encodeURIComponent(data.financialYear)}` : ''}`
      : `${SITE}/donate/receipt/${encodeURIComponent(token)}`;
    try {
      await Share.share({
        message: [
          kind === 'statement' ? `ACTIV — 80G donation certificate, FY ${fyLabel(data?.financialYear)}` : 'ACTIV — 80G donation receipt',
          data?.donor?.fullName ? `Donor: ${data.donor.fullName}` : '',
          kind === 'statement' ? `Total: ${certRupees(typeof data?.total === 'number' ? data.total : null)}` : `Amount: ${certRupees(typeof data?.amount === 'number' ? data.amount : null)}`,
          kind === 'statement' ? (data?.statementNumber ? `Certificate No: ${data.statementNumber}` : '') : (data?.receiptNumber ? `Receipt No: ${data.receiptNumber}` : ''),
          '',
          `View or print: ${link}`,
        ].filter((l, i, all) => !!l || (i > 0 && !!all[i - 1])).join('\n'),
      });
    } catch (err) {
      console.warn('Share safely caught:', err);
    }
  };

  const header = (
    <PremiumPageHeader
      onBack={() => navigation.goBack()}
      right={data ? <GlassIconButton icon="share" accessibilityLabel="Share" onPress={share} /> : undefined}
      eyebrow={kind === 'statement' ? 'Consolidated 80G' : 'Donation · 80G'}
      title={kind === 'statement' ? 'Year certificate' : '80G receipt'}
      subtitle={kind === 'statement' && data?.financialYear ? `Financial year ${fyLabel(data.financialYear)}` : 'Your tax-exemption document'}
      art={<CertificateSeal3D size={88} />}
      artLabel="Certificate with a seal"
    >
      {data ? (
        <HeaderStatRow>
          <HeaderStat
            icon="payments"
            value={certRupees(kind === 'statement' ? (typeof data?.total === 'number' ? data.total : null) : (typeof data?.amount === 'number' ? data.amount : null))}
            label={kind === 'statement' ? 'Year total' : 'Amount'}
          />
          <HeaderStat
            icon={kind === 'statement' ? 'format-list-numbered' : 'tag'}
            value={kind === 'statement' ? String(asArray(data?.donations).length) : String(data?.receiptNumber || '—')}
            label={kind === 'statement' ? 'Gifts' : 'Receipt no.'}
          />
        </HeaderStatRow>
      ) : null}
    </PremiumPageHeader>
  );

  if (loading) {
    return (
      <PremiumPage header={header}>
        <Overlap><View style={s.sheetPad}><Skeleton height={460} radius={22} /></View></Overlap>
      </PremiumPage>
    );
  }
  if (!data || !cert) {
    return (
      <PremiumPage header={header}>
        <Overlap>
          <SurfaceCard style={s.gutter}>
            <StateView kind="error" compact title="This document is not available" message={error} onAction={load} />
          </SurfaceCard>
        </Overlap>
      </PremiumPage>
    );
  }

  const yearOptions = years.map((y) => ({ value: String(y), label: `FY ${fyLabel(y)}` }));

  return (
    <PremiumPage
      header={header}
      footer={(
        <BottomActionBar note="Your PDF saves directly to Downloads on this device.">
          <GradientButton label="Download PDF" icon="download" onPress={downloadPdf} loading={savingPdf} style={s.flex} />
        </BottomActionBar>
      )}
    >
      <Overlap>
        {kind === 'statement' && years.length > 1 ? (
          years.length <= 3 ? (
            <PillTabs options={yearOptions} value={String(data?.financialYear || '')} onChange={(y) => setFy(y)} style={s.years} />
          ) : (
            <FilterChips options={yearOptions} value={String(data?.financialYear || '')} onChange={(y) => setFy(y)} style={s.years} />
          )
        ) : null}
        {kind === 'statement' && data?.isFinal === false ? (
          <Notice kind="warning" style={s.notice} text="Provisional — the financial year is still running. Any gift you make before 31 March is added here, and the final certificate is issued after the year closes." />
        ) : null}
        {kind === 'receipt' && data?.statementToken ? (
          <Notice
            kind="info"
            icon="date-range"
            style={s.notice}
            text="All your gifts this financial year are totalled on your year certificate."
            action="Open"
            onAction={() => navigation.push('DonationDocument', { kind: 'statement', token: String(data.statementToken), fy: String(data?.financialYear || '') })}
          />
        ) : null}
        {/* The certificate is one fixed A4 page (CertificateViews), scaled to
            the gutter's width; tapping it opens the full-screen zoom view. */}
        <View style={s.gutter}>
          <TaxCertificateView
            cert={cert}
            pdfRef={pdfRef}
            receiptColumn={sheetProps.receiptColumn}
            amountInWords={sheetProps.amountInWords}
            stamp={sheetProps.stamp}
            hint="Tap the certificate to view it full size"
            onPress={openZoom}
          />
        </View>
      </Overlap>
    </PremiumPage>
  );
};

const s = StyleSheet.create({
  flex: { flex: 1 },
  gutter: { marginHorizontal: SPACE.lg },
  sheetPad: { paddingHorizontal: SPACE.lg },
  years: { marginBottom: SPACE.md },
  notice: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
});

export default DonationDocumentScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
