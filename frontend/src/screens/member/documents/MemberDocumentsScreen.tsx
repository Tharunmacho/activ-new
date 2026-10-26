import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Badge, PALETTE, SPACE, SIZE, TYPE, shortDate, BRAND,
  PremiumPage, PremiumPageHeader, PREMIUM_OVERLAP, HeaderStat, HeaderStatRow, DocumentStack3D, CertificateSeal3D, ArtBadge,
  SurfaceCard, GradientGlyph, LinkRow, GroupTitle, GradientButton, CardSkeletons, MeterBar, FadeInUp,
} from '../../../ui';
import type { GlyphTone } from '../../../ui';
import {
  getMyProfile, getBusinessInfo, getDeclarationInfo, getMyApplications, formatApplicationRef, isPaidMember,
} from '../../../services/memberApi';
import {
  pickMostAdvancedApplication, profileCompletion, deriveMemberAccess, membershipCta,
} from '../dashboard/memberRules';

/**
 * Documents — website `features/member/pages/MemberDocuments.tsx`.
 *
 *   Official Documents   membership certificate · tax exemption certificate ·
 *                        payment receipt. Open once the membership is active;
 *                        before that each is shown locked with what it is.
 *   Application Record   Personal / Business / Declaration — submitted or not
 *                        (ProfileContext's completion rule), with the
 *                        application reference.
 *   The way out          the website's MembershipGate + membershipCta when not active.
 *
 * Data: my-profile · business-info · declaration-info · my-applications.
 */

const CERTIFICATES: { key: string; label: string; detail: string; icon: string; tone: GlyphTone; action: string }[] = [
  { key: 'membership', label: 'Membership Certificate', detail: 'Proof of your membership of the association, ready to share.', icon: 'workspace-premium', tone: 'blue', action: 'View certificate' },
  { key: 'tax-exemption', label: 'Tax Exemption Certificate', detail: 'Issued against an active membership for use with your filings.', icon: 'shield', tone: 'teal', action: 'View certificate' },
  { key: 'receipt', label: 'Payment Receipt', detail: 'What you paid for your membership, with the transaction reference.', icon: 'receipt-long', tone: 'green', action: 'View receipt' },
];

const FORMS = [
  { label: 'Personal Details', step: 1, icon: 'person-outline' },
  { label: 'Business Details', step: 2, icon: 'storefront' },
  { label: 'Declaration', step: 3, icon: 'history-edu' },
];

const MemberDocumentsScreen = ({ navigation }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [declaration, setDeclaration] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true);
    const [p, b, d, a] = await Promise.allSettled([getMyProfile(), getBusinessInfo(), getDeclarationInfo(), getMyApplications()]);
    setProfile(p.status === 'fulfilled' ? p.value : null);
    setBusiness(b.status === 'fulfilled' ? b.value : null);
    setDeclaration(d.status === 'fulfilled' ? d.value : null);
    setApplication(a.status === 'fulfilled' ? pickMostAdvancedApplication(a.value) : null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const paid = isPaidMember(profile);
  const completion = useMemo(() => profileCompletion(profile, business, declaration, application), [profile, business, declaration, application]);
  const access = useMemo(() => deriveMemberAccess(completion.percent, application, paid), [completion.percent, application, paid]);
  const cta = useMemo(() => membershipCta(access, profile?.renewal), [access, profile?.renewal]);
  const appRef = formatApplicationRef(application);
  const submittedAt = shortDate(application?.createdAt || application?.submittedAt);
  const formsDone = FORMS.filter((f) => (completion?.completed || []).includes(f.label)).length;
  const active = !!access?.membershipActive;

  const openCert = (key: string) => {
    if (key === 'receipt') navigation.navigate('PaymentSuccess', {});
    else navigation.navigate('MemberCertificate', { kind: key });
  };

  const runCta = () => {
    switch (cta.target) {
      case 'Renew': navigation.navigate('MembershipPlans', { renew: true }); break;
      case 'Activate': navigation.navigate('MembershipPlans'); break;
      case 'ApplicationStatus': navigation.navigate('ApplicationStatus'); break;
      case 'Submit': navigation.navigate('DeclarationForm', {}); break;
      case 'Profile': navigation.navigate('PersonalDetailsForm', {}); break;
      default: navigation.navigate('PaidDashboard');
    }
  };

  const openForm = (form: typeof FORMS[number], done: boolean) => navigation.navigate(
    done ? (paid ? 'PaidProfile' : 'MemberMain') : (form.step === 3 ? 'DeclarationForm' : form.step === 2 ? 'BusinessInformationForm' : 'PersonalDetailsForm'),
    done ? (paid ? undefined : { screen: 'Profile' }) : {},
  );

  const header = (
    <PremiumPageHeader
      eyebrow="Records & certificates"
      title="Documents"
      subtitle={loading ? 'Gathering your records…' : active ? 'Your certificates are issued and ready' : 'Certificates are issued the moment you activate'}
      onBack={() => navigation.goBack()}
      art={<DocumentStack3D size={88} />}
    >
      <HeaderStatRow>
        <HeaderStat icon="verified" value={loading ? '–' : active ? CERTIFICATES.length : 0} label="Issued" />
        <HeaderStat icon="fact-check" value={loading ? '–' : `${formsDone}/${FORMS.length}`} label="Forms" />
        <HeaderStat icon={active ? 'lock-open' : 'lock-outline'} value={loading ? '–' : active ? 'Active' : 'Locked'} label="Membership" />
      </HeaderStatRow>
    </PremiumPageHeader>
  );

  if (loading) {
    return (
      <PremiumPage header={header}>
        <View style={styles.overlap}><CardSkeletons rows={5} /></View>
      </PremiumPage>
    );
  }

  return (
    <PremiumPage header={header} refreshing={refreshing} onRefresh={() => load('refresh')}>
      <View style={styles.overlap}>
        <GroupTitle
          title="Official Documents"
          subtitle={active ? 'Issued against your active membership' : 'Issued the moment your membership is activated'}
          count={active ? CERTIFICATES.length : undefined}
          style={styles.firstGroup}
        />
        <View style={styles.stack}>
          {CERTIFICATES.map((c, i) => (
            <FadeInUp key={c.key} delay={80 + i * 60} distance={12}>
              {active ? (
                <SurfaceCard onPress={() => openCert(c.key)} accessibilityLabel={`Open ${c.label}`} style={styles.gutter}>
                  <View style={styles.certRow}>
                    <GradientGlyph icon={c.icon} tone={c.tone} size={52} />
                    <View style={styles.flexMin}>
                      <View style={styles.certTitleRow}>
                        <Text style={styles.certTitle} maxFontSizeMultiplier={1.3}>{c.label}</Text>
                        <Badge label="Issued" icon="verified" status="approved" size="sm" />
                      </View>
                      <Text style={styles.certDetail} maxFontSizeMultiplier={1.3}>{c.detail}</Text>
                      <View style={styles.openRow}>
                        <Icon name="file-download" size={16} color={PALETTE.blue} />
                        <Text style={styles.openText} maxFontSizeMultiplier={1.3}>{c.action}</Text>
                      </View>
                    </View>
                    <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />
                  </View>
                </SurfaceCard>
              ) : (
                <View style={[styles.locked, styles.gutter]} accessible accessibilityLabel={`${c.label}, locked until your membership is active`}>
                  <View>
                    <GradientGlyph icon={c.icon} tone="slate" size={52} />
                    <View style={styles.lockBadge}><Icon name="lock" size={12} color={PALETTE.white} /></View>
                  </View>
                  <View style={styles.flexMin}>
                    <Text style={styles.lockedTitle} maxFontSizeMultiplier={1.3}>{c.label}</Text>
                    <Text style={styles.certDetail} maxFontSizeMultiplier={1.3}>{c.detail}</Text>
                  </View>
                </View>
              )}
            </FadeInUp>
          ))}
        </View>

        <GroupTitle
          title="Application Record"
          subtitle={appRef ? `Application ${appRef}${submittedAt ? ` · submitted ${submittedAt}` : ''}` : 'The forms that make up your membership application'}
          action={access.applicationSubmitted ? 'Track' : 'Continue'}
          onAction={() => (access.applicationSubmitted ? navigation.navigate('ApplicationStatus') : navigation.navigate('PersonalDetailsForm', {}))}
        />
        <FadeInUp delay={260} distance={12}>
          <SurfaceCard padded={false} style={styles.gutter}>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel} maxFontSizeMultiplier={1.3}>{formsDone} of {FORMS.length} forms submitted</Text>
              <Text style={styles.progressPct} maxFontSizeMultiplier={1.3}>{Math.round((formsDone / FORMS.length) * 100)}%</Text>
            </View>
            <MeterBar value={formsDone / FORMS.length} colors={formsDone === FORMS.length ? ['#047857', '#34D399'] : undefined} style={styles.meter} />
            {FORMS.map((form, i) => {
              const done = (completion?.completed || []).includes(form.label);
              return (
                <LinkRow
                  key={form.label}
                  leading={(
                    <View>
                      <GradientGlyph icon={form.icon} tone={done ? 'green' : 'slate'} size={40} />
                      <View style={[styles.stateDot, { backgroundColor: done ? PALETTE.green : PALETTE.amber }]}>
                        <Icon name={done ? 'check' : 'schedule'} size={10} color={PALETTE.white} />
                      </View>
                    </View>
                  )}
                  title={form.label}
                  subtitle={done ? 'Submitted' : 'Not submitted yet'}
                  onPress={() => openForm(form, done)}
                  right={<Text style={styles.formAction} maxFontSizeMultiplier={1.3}>{done ? 'View' : 'Complete'}</Text>}
                  last={i === FORMS.length - 1}
                />
              );
            })}
          </SurfaceCard>
        </FadeInUp>

        {!active ? (
          <FadeInUp delay={320} distance={12}>
            <GroupTitle title="Certificates" />
            <SurfaceCard style={styles.gutter}>
              <View style={styles.gateTop}>
                <ArtBadge size={72}><CertificateSeal3D size={56} /></ArtBadge>
                <View style={styles.flexMin}>
                  <Text style={styles.gateTitle} maxFontSizeMultiplier={1.3}>Your certificates are issued on activation</Text>
                  <Text style={styles.gateBody} maxFontSizeMultiplier={1.3}>
                    The membership and tax exemption certificates are generated against your own record the moment your
                    membership becomes active — there is nothing further to apply for.
                  </Text>
                </View>
              </View>
              {cta.detail ? <Text style={styles.gateNote} maxFontSizeMultiplier={1.3}>{cta.detail}</Text> : null}
              <GradientButton label={cta.label} iconRight="arrow-forward" onPress={runCta} style={{ marginTop: SPACE.lg }} />
            </SurfaceCard>
          </FadeInUp>
        ) : null}
      </View>
    </PremiumPage>
  );
};

const styles = StyleSheet.create({
  flexMin: { flex: 1, minWidth: 0 },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  firstGroup: { marginTop: 0 },
  gutter: { marginHorizontal: SPACE.lg },
  stack: { gap: SPACE.md },
  certRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  certTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.sm },
  certTitle: { ...TYPE.subheading, fontWeight: '700', flexShrink: 1 },
  certDetail: { ...TYPE.caption, fontSize: 13, lineHeight: 18, fontWeight: '400', marginTop: SPACE.xs },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm },
  openText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.blue },
  locked: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderRadius: 22,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: PALETTE.borderStrong, backgroundColor: PALETTE.fieldBg,
  },
  lockBadge: {
    position: 'absolute', right: -4, bottom: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: BRAND.navy,
    borderWidth: 2, borderColor: PALETTE.white, alignItems: 'center', justifyContent: 'center',
  },
  lockedTitle: { ...TYPE.subheading, color: PALETTE.textSoft },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACE.lg, paddingTop: SPACE.lg },
  progressLabel: { ...TYPE.label, flexShrink: 1 },
  progressPct: { fontSize: 13, lineHeight: 18, fontWeight: '800', color: BRAND.navy, fontVariant: ['tabular-nums'] },
  meter: { marginHorizontal: SPACE.lg, marginTop: SPACE.sm, marginBottom: SPACE.xs },
  stateDot: {
    position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: PALETTE.white,
    alignItems: 'center', justifyContent: 'center',
  },
  formAction: { ...TYPE.label, color: PALETTE.blue, fontWeight: '700', minWidth: 0 },
  gateTop: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  gateTitle: { ...TYPE.heading },
  gateBody: { ...TYPE.body, marginTop: SPACE.xs },
  gateNote: { ...TYPE.small, marginTop: SPACE.md },
});

export default MemberDocumentsScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
