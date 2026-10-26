import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Share, Alert } from 'react-native';
import {
  Skeleton, Notice, BottomActionBar, SPACE, RADIUS, errorText, CompanyChip,
  PremiumPage, PremiumPageHeader, PREMIUM_OVERLAP, HeaderStat, HeaderStatRow, GlassIconButton, GradientButton,
  PillTabs, StateView, SurfaceCard, GradientGlyph, FadeInUp, CertificateSeal3D,
} from '../../../ui';
import { AppTheme, useThemeStyles } from '../../../ui/AppTheme';
import { useActiveCompany, useActiveCompanyStore } from '../../../stores/activeCompanyStore';
import { getCertificate } from '../../../services/memberApi';
import { saveCertificatePdf } from '../../../services/certificateExport';
import { isPaymentGate } from '../useLoad';
import MemberLocked from '../MemberLocked';
import { MembershipCertificateView, TaxCertificateView, certDate, certRupees, fullYear } from './CertificateViews';

/**
 * A member's certificate — website `/member/certificate/:kind` (CertificatePage).
 *
 *   GET /members/certificate/membership
 *   GET /members/certificate/tax-exemption
 *
 * The server sends the fields, no PDF; the certificate is drawn natively
 * (CertificateViews). The server refuses with 403 until the membership is
 * active — that refusal IS the answer, so it is shown as the locked state, not
 * as a blank certificate.
 *
 * Download saves the complete native certificate as an A4 PDF. Sharing also
 * offers the certificate's facts and its authenticated website link.
 */

type Kind = 'membership' | 'tax-exemption';
const SITE = 'https://activ.org.in';

const shareText = (kind: Kind, cert: any): string => {
  const m = cert?.member || {};
  if (kind === 'tax-exemption') {
    const c = cert?.contribution || {};
    return [
      'ACTIV — Certificate of Tax Exemption (Section 80G, Income Tax Act, 1961)',
      m?.name ? `Name: ${m.name}` : '',
      m?.pan ? `PAN: ${m.pan}` : '',
      cert?.financialYear ? `Financial year: ${fullYear(cert.financialYear)}` : '',
      typeof c?.amount === 'number' ? `Amount: ${certRupees(c.amount)}` : '',
      cert?.reference ? `Certificate No: ${cert.reference}` : '',
      cert?.issuedAt ? `Issued: ${certDate(cert.issuedAt)}` : '',
      '',
      `View or print: ${SITE}/member/certificate/tax-exemption`,
    ].filter((l) => l !== null).join('\n').replace(/\n{3,}/g, '\n\n');
  }
  const platinum = String(cert?.membershipTier || '') === 'platinum';
  const valid = platinum ? 'Lifetime' : cert?.validUntil ? certDate(cert.validUntil) : String(cert?.membershipType || '') === 'lifetime' ? 'Lifetime' : '';
  return [
    'ACTIV — Membership Certificate',
    `${m?.companyName || m?.name || 'Member'} has been admitted as ${platinum ? 'a Lifetime Member' : 'an official member'} of ACTIV.`,
    m?.membershipNumber ? `Membership No: ${m.membershipNumber}` : '',
    valid ? `Valid till: ${valid}` : '',
    cert?.reference ? `Certificate No: ${cert.reference}` : '',
    '',
    `View or print: ${SITE}/member/certificate/membership${cert?.companyId ? `?companyId=${encodeURIComponent(cert.companyId)}` : ''}`,
  ].filter(Boolean).join('\n');
};

const MemberCertificateScreen = ({ navigation, route }: any) => {
  const s = useThemeStyles(makeStyles);
  const activeCompany = useActiveCompany();
  const companies = useActiveCompanyStore(state => state.companies);
  const loadCompanies = useActiveCompanyStore(state => state.loadCompanies);
  const setActiveCompany = useActiveCompanyStore(state => state.setActiveCompany);
  const [companiesReady, setCompaniesReady] = useState(false);
  const initial: Kind = route?.params?.kind === 'tax-exemption' ? 'tax-exemption' : 'membership';
  const [kind, setKind] = useState<Kind>(initial);
  const companyId = kind === 'membership' ? activeCompany?._id : undefined;
  const scope = `${kind}:${companyId || 'member'}`;
  const [resultScope, setResultScope] = useState('');
  const [certificate, setCert] = useState<any>(null);
  const cert = resultScope === scope ? certificate : null;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [gated, setGated] = useState(false);
  const alive = useRef(true);
  const requestId = useRef(0);
  const pdfRef = useRef<View>(null);
  const [savingPdf, setSavingPdf] = useState(false);

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (!companiesReady && kind === 'membership') return;
    const request = ++requestId.current;
    const isCurrent = () => alive.current && request === requestId.current;
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    setCert(null);
    setError('');
    setGated(false);
    try {
      const c = await getCertificate(kind, companyId);
      if (!isCurrent()) return;
      if (companyId && String(c?.companyId || '') !== companyId) {
        setError('The selected company certificate could not be loaded. Please try again.');
        return;
      }
      setCert(c);
      if (!c) setError('This certificate could not be issued');
    } catch (err) {
      if (!isCurrent()) return;
      setCert(null);
      setGated(isPaymentGate(err));
      setError(errorText(err, 'This certificate could not be issued'));
    } finally {
      if (isCurrent()) { setResultScope(scope); setLoading(false); setRefreshing(false); }
    }
  }, [kind, companyId, scope, companiesReady]);

  useEffect(() => { setKind(initial); }, [initial]);

  useEffect(() => {
    let active = true;
    void loadCompanies().then(() => { if (active) setCompaniesReady(true); });
    return () => { active = false; };
  }, [loadCompanies]);

  useEffect(() => {
    alive.current = true;
    load();
    const removeFocusListener = navigation?.addListener?.('focus', () => { void load(); });
    return () => { alive.current = false; ++requestId.current; removeFocusListener?.(); };
  }, [load, navigation]);

  const share = useCallback(async () => {
    if (!cert) return;
    try {
      await Share.share({ message: shareText(kind, cert), title: kind === 'tax-exemption' ? 'Tax Exemption Certificate' : 'Membership Certificate' });
    } catch (err) {
      console.warn('Share safely caught:', err);
    }
  }, [cert, kind]);

  const downloadPdf = async () => {
    if (!cert || savingPdf) return;
    setSavingPdf(true);
    try {
      const saved = await saveCertificatePdf(pdfRef.current, `ACTIV-${kind}-${cert.reference || 'certificate'}.pdf`);
      if (saved) Alert.alert('PDF saved', 'Your certificate has been saved in Downloads on this device.');
    } catch (err) {
      Alert.alert('PDF could not be saved', errorText(err, 'Please try again.'));
    } finally {
      if (alive.current) setSavingPdf(false);
    }
  };

  const platinum = String(cert?.membershipTier || '') === 'platinum';
  const validTill = platinum
    ? 'Lifetime'
    : cert?.validUntil ? certDate(cert.validUntil) : String(cert?.membershipType || '') === 'lifetime' ? 'Lifetime' : '';
  const ready = !!cert && !error && !loading;

  const header = (
    <PremiumPageHeader
      eyebrow={kind === 'tax-exemption' ? 'Section 80G · Income Tax Act' : 'Official document'}
      title={kind === 'tax-exemption' ? 'Tax exemption certificate' : 'Membership certificate'}
      subtitle={ready ? 'Issued by ACTIV — view it or download your PDF.' : 'Your certificates, drawn from your membership record.'}
      onBack={() => navigation.goBack()}
      right={ready ? <GlassIconButton icon="share" accessibilityLabel="Share certificate" onPress={share} /> : null}
      art={<CertificateSeal3D size={88} />}
    >
      {ready ? (
        <HeaderStatRow>
          <HeaderStat
            icon="tag"
            label="Certificate no."
            value={String(cert?.reference || '—')}
          />
          {kind === 'tax-exemption' ? (
            <HeaderStat icon="date-range" label="Financial year" value={fullYear(cert?.financialYear || '') || '—'} />
          ) : (
            <HeaderStat icon="event-available" label="Valid till" value={validTill || '—'} />
          )}
        </HeaderStatRow>
      ) : null}
    </PremiumPageHeader>
  );

  const tabs = (
    <FadeInUp delay={200} style={s.tabs}>
      <PillTabs<Kind>
        value={kind}
        onChange={setKind}
        options={[
          { value: 'membership', label: 'Membership', icon: 'workspace-premium' },
          { value: 'tax-exemption', label: 'Tax (80G)', icon: 'receipt-long' },
        ]}
      />
      {kind === 'membership' && (companies || []).length > 0 ? (
        <View style={s.companySection}>
          <Text style={s.verifyTitle}>Certificate company</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.companyChoices}>
            {(companies || []).map(company => (
              <CompanyChip key={company._id} name={company.businessName || 'Company'}
                active={companyId === company._id} onPress={() => setActiveCompany(company._id)} />
            ))}
          </ScrollView>
          <Text style={s.verifyText}>{activeCompany?.publication?.unlimited
            ? 'Your ₹2 lakh membership covers your companies with the same membership ID. The certificate shows the selected company.'
            : 'Your included company uses your membership ID. Each paid additional company has its own ID; unpaid drafts remain private.'}</Text>
        </View>
      ) : null}
    </FadeInUp>
  );

  if (loading || resultScope !== scope) {
    return (
      <PremiumPage header={header}>
        {tabs}
        <View style={s.sheet} accessibilityLabel="Preparing your certificate">
          <Skeleton height={560} radius={RADIUS.xs} />
        </View>
      </PremiumPage>
    );
  }

  if (error || !cert) {
    return (
      <PremiumPage header={header} onRefresh={() => load('refresh')} refreshing={refreshing}>
        {tabs}
        {gated && activeCompany?.publication?.paymentRequired && kind === 'membership' ? (
          <StateView kind="empty" title="Activate this company’s membership"
            message="This extra company is private. Pay its publishing plan to make it visible and receive its own membership ID and certificate."
            action="View publishing plan"
            onAction={() => navigation.navigate('Settings')} />
        ) : gated ? (
          <FadeInUp delay={260} style={s.gate}>
            <MemberLocked feature="Your certificates" onActivate={() => navigation.navigate('MembershipPlans')} />
          </FadeInUp>
        ) : (
          <StateView
            kind="error"
            art={<CertificateSeal3D size={84} />}
            title="This certificate could not be issued"
            message={error || 'This certificate could not be issued'}
            onAction={() => load()}
          />
        )}
      </PremiumPage>
    );
  }

  return (
    <PremiumPage
      header={header}
      onRefresh={() => load('refresh')}
      refreshing={refreshing}
      footer={(
        <BottomActionBar note="Your PDF saves directly to Downloads on this device.">
          <GradientButton label="Download PDF" icon="download" onPress={downloadPdf} loading={savingPdf} disabled={refreshing} style={s.grow} />
        </BottomActionBar>
      )}
    >
      {tabs}
      {kind === 'tax-exemption' && !(cert?.contribution && typeof cert.contribution.amount === 'number') ? (
        <FadeInUp delay={240}>
          <Notice kind="info" style={s.notice} text="The amount of your payment is not on record, so no figure is printed on this certificate." />
        </FadeInUp>
      ) : null}
      <FadeInUp key={kind} delay={260} distance={24} style={s.sheet}>
        {kind === 'tax-exemption' ? (
          <TaxCertificateView
            cert={cert}
            pdfRef={pdfRef}
            hint="Tap the certificate to view it full size"
            onPress={() => {
              try {
                navigation.navigate('CertificateZoom', { cert });
              } catch (err) {
                console.warn('Certificate zoom navigation safely caught:', err);
              }
            }}
          />
        ) : <MembershipCertificateView cert={cert} pdfRef={pdfRef} hint="A4 landscape · Tap to zoom" onPress={() => navigation.navigate('CertificateZoom', { cert, kind: 'membership' })} />}
      </FadeInUp>
      <FadeInUp delay={320}>
        <SurfaceCard style={s.verify}>
          <View style={s.verifyRow}>
            <GradientGlyph icon="verified" tone="green" size={40} />
            <View style={s.flexMin}>
              <Text style={s.verifyTitle} maxFontSizeMultiplier={1.3}>Issued from your membership record</Text>
              <Text style={s.verifyText} maxFontSizeMultiplier={1.3}>
                {cert?.issuedAt ? `Issued ${certDate(cert.issuedAt)}` : 'Issued by ACTIV'}
                {cert?.reference ? ` · No. ${cert.reference}` : ''}. Nothing on it is filled in by hand — a fact not on record is left off.
              </Text>
            </View>
          </View>
        </SurfaceCard>
      </FadeInUp>
    </PremiumPage>
  );
};

const makeStyles = ({ type: TYPE }: AppTheme) => StyleSheet.create({
  tabs: { marginTop: -PREMIUM_OVERLAP },
  sheet: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg },
  gate: { marginTop: SPACE.md },
  notice: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  verify: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  verifyRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  verifyTitle: { ...TYPE.subheading },
  verifyText: { ...TYPE.caption, marginTop: 2 },
  flexMin: { flex: 1, minWidth: 0 },
  grow: { flex: 1 },
  companySection: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg, gap: SPACE.sm },
  companyChoices: { gap: SPACE.sm, paddingVertical: SPACE.sm },
});

export default MemberCertificateScreen;
