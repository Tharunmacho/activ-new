import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Linking,
  Platform,
  UIManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types';
import api from '../../services/api';
import { resolveMediaUrl } from '../../config/api.config';
import { formatApplicationRef } from '../../services/memberApi';
import {
  BottomActionBar, PALETTE, SPACE, TYPE, SIZE,
  ConsoleScroll, ConsoleHeader, ConsoleCard, ConsoleSectionTitle, ConsoleNote, ConsoleButton, ConsoleChip,
  TierProgressRail, tierTrail, GradientAvatar, GlassIconButton, PremiumInput, FadeInUp,
  CONSOLE_ACCENTS, ConsoleAccent,
} from '../../ui';
import { displayValue, formatDate } from './applicantStyles';

type Props = NativeStackScreenProps<RootStackParamList, 'ApplicantDetail'>;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type SectionKey = 'personal' | 'business' | 'financial' | 'declaration';

interface DetailRow {
  label: string;
  value: string;
  icon: string;
}

const hasValue = (raw: unknown): boolean => {
  if (raw === null || raw === undefined || raw === '') return false;
  if (Array.isArray(raw)) return raw.length > 0;
  return true;
};

/** `true`/`false` may arrive as a real Boolean or as the string form (website `asBool`). */
const asBool = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 'yes') return true;
  if (v === 'false' || v === 'no') return false;
  return undefined;
};

const buildRows = (rows: { label: string; raw: unknown; icon?: string }[]): DetailRow[] =>
  rows
    .filter(row => hasValue(row.raw))
    .map(row => ({
      label: row.label,
      value: displayValue(row.raw),
      icon: row.icon || 'info-outline',
    }));

const TIER_WORD: Record<string, string> = { block: 'Block', district: 'District', state: 'State' };
const ADMIN_TYPE: Record<string, string> = {
  BlockAdmin: 'Block Admin', DistrictAdmin: 'District Admin', StateAdmin: 'State Admin', SuperAdmin: 'ACTIV Head Office',
};

/** One fact tile in the dossier's grid. */
function Fact({ icon, label, value, wide }: { icon: string; label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.fact, wide && styles.factWide]}>
      <View style={styles.factIcon}><Icon name={icon} size={16} color={PALETTE.indigo} /></View>
      <View style={styles.flexText}>
        <Text style={styles.factLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.factValue} numberOfLines={2} selectable>{value || '—'}</Text>
      </View>
    </View>
  );
}

/**
 * ============================================================================
 * APPLICANT DOSSIER — the website's application detail, as a premium dossier
 * ============================================================================
 *
 * Hero with the applicant's photo (floating gradient avatar), role and status;
 * a facts grid; the Block → District → State review trail with each tier's
 * date; the four submitted forms as collapsible sections; any uploaded
 * documents; and a sticky decision bar. Rejection is an inline reason card —
 * never a native Modal (Rule 2). Same fetch, same payloads as before.
 */
const ApplicantDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { applicant } = route.params;

  const [fullApp, setFullApp] = useState<any>(applicant);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>({
    personal: true,
    business: true,
    financial: true,
    declaration: true,
  });
  const [submitting, setSubmitting] = useState<'approve' | 'reject' | null>(null);
  const [stage, setStage] = useState(applicant.stage || 'pending');
  const [statusLabel, setStatusLabel] = useState(applicant.statusLabel || applicant.status || 'Pending');

  useEffect(() => {
    fetchApplicationDetails();
    // Mount-only: one fetch per opened applicant (the route param never changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loadError, setLoadError] = useState('');

  /*
   * GET /applications/:id - the website's `getApplication`, the same record its
   * detail modal renders. `/applications/user/:userId` is kept only as the
   * fallback for a row that carries no application id.
   */
  const fetchApplicationDetails = async () => {
    const appId = applicant?.applicationId || applicant?._id || applicant?.id;
    const userId = applicant?.userId || applicant?.memberId;

    setIsLoadingDetails(true);
    setLoadError('');
    try {
      if (appId) {
        const res = await api.get(`/applications/${appId}`);
        const payload = res?.data?.data || res?.data || null;
        if (payload && typeof payload === 'object' && (payload._id || payload.data || payload.fullName)) {
          setFullApp((prev: any) => ({ ...(prev || {}), ...payload }));
          return;
        }
      }
      if (userId) {
        const res = await api.get(`/applications/user/${userId}`);
        const list = Array.isArray(res?.data?.data) ? res.data.data : res?.data?.applications || [];
        if ((list || []).length > 0) {
          setFullApp((prev: any) => ({ ...(prev || {}), ...list[0] }));
          return;
        }
      }
      if (!appId && !userId) setLoadError('This row carries no application reference.');
    } catch (err: any) {
      setLoadError(err?.response?.data?.message || 'Failed to load application data');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  /*
   * WHETHER THIS ADMIN MAY STILL DECIDE is the server's `canAct` — never
   * re-derived from the status (CLAUDE.md). The stage is only the fallback for
   * an older payload that carries no `canAct`. Once this admin decides here,
   * it is off.
   */
  const [decided, setDecided] = useState(false);
  const serverCanAct = (applicant as any)?.canAct;
  const isPending = !decided && (typeof serverCanAct === 'boolean' ? serverCanAct : stage === 'pending');
  const decidesOutcome = (applicant as any)?.decidesOutcome;
  const endorsementLine = String((applicant as any)?.endorsementLine || fullApp?.endorsementLine || '');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  const toggleSection = (key: SectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setAll = (open: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded({ personal: open, business: open, financial: open, declaration: open });
  };

  const submitReview = async (action: 'approve' | 'reject') => {
    setSubmitting(action);
    const appId = fullApp.applicationId || fullApp._id || fullApp.id;
    try {
      // Exactly the website's payloads: approve `{}`, reject `{ rejectionReason }`.
      const res: any = await api.post(
        `/applications/${appId}/${action}`,
        action === 'reject' ? { rejectionReason: (reason || '').trim() || 'No reason given' } : {},
      );
      const serverMessage = String(res?.data?.message || '');

      setDecided(true);
      setRejecting(false);
      setStage(action === 'approve' ? 'approved' : 'rejected');
      setStatusLabel(action === 'approve' ? 'Approved' : 'Rejected');

      Alert.alert(
        action === 'approve' ? 'Approved' : 'Rejected',
        serverMessage || (action === 'approve'
          ? (decidesOutcome === false
            ? `Your approval of ${fullApp.fullName || applicant.fullName} is recorded. The State Admin grants the membership.`
            : `${fullApp.fullName || applicant.fullName}'s application has been approved.`)
          : `Your rejection of ${fullApp.fullName || applicant.fullName}'s application is recorded.`),
        [{ text: 'Back to List', onPress: () => navigation.goBack() }],
      );
    } catch (error: any) {
      Alert.alert(
        'Action failed',
        error.response?.data?.message || 'Could not update the application',
      );
    } finally {
      setSubmitting(null);
    }
  };

  const confirmReview = (action: 'approve' | 'reject') => {
    const name = fullApp.fullName || applicant.fullName;
    // A rejection needs the reason typed inline first (no native Modal).
    if (action === 'reject' && !rejecting) { setRejecting(true); return; }
    // A blank reason is sent as "No reason given", exactly as the website does.
    Alert.alert(
      action === 'approve' ? 'Approve applicant' : 'Reject applicant',
      `${action === 'approve' ? 'Approve' : 'Reject'} the application from ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'approve' ? 'default' : 'destructive',
          onPress: () => submitReview(action),
        },
      ],
    );
  };

  /*
   * THE WEBSITE'S `getApplicationProfile` FLATTENING.
   *
   * Applications are stored two ways: nested (`data.personalDetails`, ...) and
   * flat on `data` itself (older rows, the registration path). The flat shape
   * is spread first and the nested sections over it, so both read - the same
   * precedence the website's detail modal uses. The queue row (`applicant`)
   * sits underneath everything as the last fallback.
   */
  const appData: any = fullApp?.data || {};
  const p: any = {
    ...(applicant || {}),
    ...(fullApp || {}),
    ...appData,
    ...(appData?.personalDetails || appData?.personal || (fullApp as any)?.personalDetails || {}),
    ...(appData?.businessInfo || appData?.business || (fullApp as any)?.businessInfo || {}),
    ...(appData?.financialInfo || appData?.financial || (fullApp as any)?.financialInfo || {}),
    ...(appData?.declaration || (fullApp as any)?.declaration || {}),
  };
  const personal: any = appData?.personalDetails || appData?.personal || (fullApp as any)?.personalDetails || {};
  const business: any = appData?.businessInfo || appData?.business || (fullApp as any)?.businessInfo || {};
  const fullName = fullApp?.fullName || personal?.fullName || applicant?.fullName || '';
  const phone = fullApp?.phone || personal?.phoneNumber || personal?.phone || applicant?.phone || '';
  const email = fullApp?.email || personal?.email || applicant?.email || '';
  const doingBusiness = asBool(business?.doingBusiness ?? appData?.doingBusiness ?? (applicant as any)?.doingBusiness);
  const registrationType = String(fullApp?.registrationType || (applicant as any)?.registrationType || '').toLowerCase();
  const memberType = String(fullApp?.memberType || (applicant as any)?.memberType || '').toLowerCase();
  const abroad = fullApp?.isInternational === true || (applicant as any)?.isInternational === true;

  /*
   * The server's rule (admin.service.js), as the website applies it: BOTH
   * `doingBusiness === false` AND an explicit aspirant/student marker.
   */
  const isStudent = doingBusiness === false && (registrationType === 'student' || memberType === 'student');
  const isAspirant = isStudent || (doingBusiness === false && (registrationType === 'aspirant' || memberType === 'aspirant'));
  // Looser on purpose: anyone not trading has no sister concerns to show.
  const notTrading = doingBusiness === false
    || ['aspirant', 'student'].includes(registrationType)
    || ['aspirant', 'student'].includes(memberType);
  const userRole = isStudent ? 'Student' : isAspirant ? 'Aspirant' : 'Business Member';
  const rejectionReason = String((applicant as any)?.rejectionReason || fullApp?.rejectionReason || '');

  const sections: {
    key: SectionKey;
    title: string;
    subtitle: string;
    icon: string;
    accent: ConsoleAccent;
    rows: DetailRow[];
  }[] = [
    {
      key: 'personal',
      title: 'Form 1: Personal & Demographic Details',
      subtitle: 'Basic contact and demographic information',
      icon: 'person',
      accent: 'indigo',
      rows: buildRows([
        { label: 'Full Name', raw: fullName || p.name, icon: 'person-outline' },
        { label: 'Membership Type', raw: fullApp?.memberType || fullApp?.registrationType || (applicant as any)?.memberType || p.role, icon: 'card-membership' },
        { label: 'Block', raw: fullApp?.block || personal?.block || applicant?.block, icon: 'location-city' },
        { label: 'City / Town', raw: personal?.city || p.city, icon: 'place' },
        { label: 'District', raw: fullApp?.district || personal?.district || applicant?.district, icon: 'map' },
        { label: 'State', raw: fullApp?.state || personal?.state || applicant?.state, icon: 'public' },
        // An applicant from abroad has no block or district: the country and
        // place are what they gave (the queue names them the same way).
        { label: 'Country', raw: abroad ? (fullApp?.country || (applicant as any)?.country) : '', icon: 'flag' },
        { label: 'Place', raw: abroad ? (fullApp?.place || (applicant as any)?.place) : '', icon: 'pin-drop' },
        { label: 'Phone Number', raw: phone, icon: 'phone' },
        { label: 'Email Address', raw: email, icon: 'email' },
        { label: 'Date of Birth', raw: (p.dateOfBirth || p.dob) ? formatDate(p.dateOfBirth || p.dob) : '', icon: 'cake' },
        { label: 'Gender', raw: p.gender || 'Not provided', icon: 'wc' },
        { label: 'Aadhaar / ID No', raw: p.aadhaarNumber || p.aadhaar || p.idNumber, icon: 'badge' },
        { label: 'Street Address', raw: p.streetName || p.street || p.address, icon: 'home' },
        { label: 'Education', raw: p.educationalQualification || p.education, icon: 'school' },
        { label: 'Religion', raw: p.religion || 'Not provided', icon: 'star-outline' },
        { label: 'Social Category', raw: p.socialCategory || 'Not provided', icon: 'category' },
      ]),
    },
    /*
     * No hard gate on Forms 2 and 3 (website parity): a section with nothing
     * filled in drops out on its own.
     */
    {
      key: 'business',
      title: 'Form 2: Business Information',
      subtitle: 'Company profile and operational details',
      icon: 'business-center',
      accent: 'sky',
      rows: buildRows([
        { label: 'Doing Business', raw: doingBusiness, icon: 'storefront' },
        { label: 'Organization Name', raw: p.organizationName || p.businessName, icon: 'corporate-fare' },
        { label: 'Constitution Type', raw: p.constitutionType, icon: 'gavel' },
        { label: 'Business Type', raw: p.businessTypes || p.businessType, icon: 'domain' },
        { label: 'Business Activities', raw: p.businessActivities, icon: 'work' },
        { label: 'Commencement Year', raw: p.businessCommencementYear, icon: 'event' },
        { label: 'Employees Count', raw: p.numberOfEmployees, icon: 'groups' },
        { label: 'Other Chamber Member', raw: asBool(p.memberOfOtherChamber), icon: 'verified' },
        { label: 'Other Chamber Details', raw: p.otherChamber, icon: 'groups' },
        { label: 'Govt. Organizations', raw: p.govtOrganizations, icon: 'account-balance' },
      ]),
    },
    {
      key: 'financial',
      title: 'Form 3: Financial & Compliance',
      subtitle: 'Taxation, scheme benefits and compliance',
      icon: 'account-balance-wallet',
      accent: 'green',
      rows: buildRows([
        { label: 'PAN Number', raw: p.panNumber, icon: 'subtitles' },
        { label: 'GST Number', raw: p.gstNumber, icon: 'receipt' },
        { label: 'Udyam Number', raw: p.udyamNumber, icon: 'confirmation-number' },
        { label: 'ITR Filed', raw: asBool(p.filedITR ?? p.itrFiled), icon: 'check-circle' },
        { label: 'Turnover Range', raw: p.turnoverRange || p.lastYearTurnover, icon: 'attach-money' },
        { label: 'Govt. Scheme Benefits', raw: asBool(p.govtSchemeBenefit), icon: 'card-giftcard' },
        { label: 'Schemes Availed', raw: p.govtSchemes, icon: 'redeem' },
        { label: 'Other Scheme Details', raw: p.schemeDetails, icon: 'notes' },
      ]),
    },
    {
      key: 'declaration',
      title: 'Form 4: Declaration & Terms',
      subtitle: 'Affiliation and legal agreement',
      icon: 'assignment-turned-in',
      accent: 'amber',
      rows: buildRows([
        ...(isAspirant || notTrading
          ? []
          : [
              { label: 'Sister Concerns', raw: p.sisterConcerns, icon: 'hub' },
              { label: 'Company Names', raw: p.companyNames, icon: 'business' },
            ]),
        // No "assume yes": the agreement is on the record or it is not.
        { label: 'Agreed to Terms', raw: asBool(p.agreeToDeclaration ?? p.agreeToTerms), icon: 'rule' },
        { label: 'Submitted Date', raw: formatDate(fullApp?.createdAt || (applicant as any)?.submittedAt || null), icon: 'today' },
      ]),
    },
  ];

  const visibleSections = sections.filter(sec => sec.rows.length > 0);
  const allOpen = visibleSections.every(sec => expanded[sec.key]);

  const displayName = fullName || 'Applicant';
  const photoPath = String(p?.profilePhoto || '');
  const photo = photoPath ? resolveMediaUrl(photoPath) : '';
  const place = abroad
    ? ['Outside India', fullApp?.place || (applicant as any)?.place, fullApp?.country || (applicant as any)?.country].filter(Boolean).join(' · ')
    : [
      fullApp?.block || personal?.block || applicant?.block,
      fullApp?.district || personal?.district || applicant?.district,
    ].filter(Boolean).join(', ');
  const submittedOn = formatDate(fullApp?.createdAt || (applicant as any)?.submittedAt || null);
  const reference = formatApplicationRef(fullApp || applicant) || '';
  const showOthersNotice = !!(endorsementLine || (isPending && decidesOutcome === false));

  // The trail: the full record's `reviews` when loaded, the row's `tierReviews` before.
  const trailSource = fullApp?.reviews ? fullApp : applicant;
  const trail = tierTrail(trailSource);
  const reviewDetail = (tier: string) => (fullApp?.reviews?.[tier] || (applicant as any)?.tierReviews?.[tier] || {}) as any;

  const documents: any[] = Array.isArray(fullApp?.documents) ? fullApp.documents.filter((d: any) => d && (d.url || d.name)) : [];
  const openDocument = async (doc: any) => {
    const raw = String(doc?.url || '');
    if (!raw) return;
    const url = /^https?:\/\//i.test(raw) ? raw : resolveMediaUrl(raw);
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open', 'No app on this phone can open this document.');
    }
  };

  const footer = isPending ? (
    <BottomActionBar note={rejecting ? 'Type a reason, then tap Reject again to confirm.' : undefined}>
      <ConsoleButton
        kind={rejecting ? 'dangerSolid' : 'danger'}
        icon="cancel"
        label="Reject"
        loading={submitting === 'reject'}
        disabled={submitting !== null}
        onPress={() => confirmReview('reject')}
        style={styles.flex}
      />
      <ConsoleButton
        kind="approve"
        icon="check-circle"
        label="Approve"
        loading={submitting === 'approve'}
        disabled={submitting !== null}
        onPress={() => confirmReview('approve')}
        style={styles.flex}
      />
    </BottomActionBar>
  ) : (
    <BottomActionBar>
      <ConsoleButton kind="soft" icon="format-list-bulleted" label="Back to List" onPress={() => navigation.goBack()} style={styles.flex} />
    </BottomActionBar>
  );

  return (
    <ConsoleScroll footer={footer} avoidKeyboard>
      <ConsoleHeader
        left={<GlassIconButton icon="arrow-back" onPress={() => navigation.goBack()} accessibilityLabel="Back" />}
        topCenter="Application details"
        eyebrow={reference || 'Application'}
        title={displayName}
        subtitle="Complete application information submitted by the member"
        art={(
          <View style={styles.heroAvatar}>
            <GradientAvatar
              name={displayName}
              uri={photo}
              size={92}
              tone="admin"
              status={String(stage) === 'approved' ? 'verified' : String(stage) === 'pending' ? 'pending' : undefined}
            />
          </View>
        )}
        badges={[
          { icon: isAspirant ? 'school' : 'business', label: userRole },
          { icon: String(stage) === 'approved' ? 'verified' : String(stage) === 'rejected' ? 'block' : 'schedule', label: String(statusLabel || '') },
        ]}
        waveHeight={62}
      />

      {/* Facts grid, lifted over the waves. */}
      <FadeInUp style={styles.overlap}>
        <ConsoleCard>
          <View style={styles.facts}>
            <Fact icon="phone" label="Phone" value={phone} />
            <Fact icon="today" label="Submitted" value={submittedOn} />
            <Fact icon="place" label="Region" value={place} />
            <Fact icon="badge" label="Membership" value={memberType ? memberType.charAt(0).toUpperCase() + memberType.slice(1) : userRole} />
            <Fact icon="email" label="Email" value={email} wide />
          </View>
        </ConsoleCard>
      </FadeInUp>

      <View style={styles.stack}>
        {/* What the OTHER tiers recorded, and what this tier's decision means. */}
        {showOthersNotice ? (
          <ConsoleNote
            icon="info-outline"
            text={`${endorsementLine}${endorsementLine && isPending && decidesOutcome === false ? ' · ' : ''}${isPending && decidesOutcome === false
              ? 'Your decision is recorded for the file; the State Admin grants the membership.'
              : ''}`}
          />
        ) : null}

        {isPending ? null : String(stage) === 'pending' ? (
          // Pending but not this seat's to decide (e.g. an orphaned file) —
          // the website simply shows no buttons; never call it rejected.
          <ConsoleNote
            kind="amber"
            icon="schedule"
            text={String((applicant as any)?.fallbackReason || '') || 'Awaiting a decision.'}
          />
        ) : (
          <ConsoleNote
            kind={stage === 'approved' ? 'green' : 'red'}
            icon={stage === 'approved' ? 'verified' : 'error-outline'}
            text={stage === 'approved'
              ? (decidesOutcome === false ? 'Approved by you — the State Admin grants the membership' : 'Approved')
              : rejectionReason || 'This application was rejected.'}
          />
        )}

        {/* Inline rejection reason — never a native Modal (Rule 2). */}
        {isPending && rejecting ? (
          <FadeInUp>
            <ConsoleCard accent={PALETTE.red}>
              <PremiumInput
                tone="admin"
                label="Reason for rejection"
                icon="edit-note"
                value={reason}
                onChangeText={setReason}
                placeholder="Why is this being rejected?"
                multiline
                autoFocus
                style={styles.fieldFlush}
              />
              <View style={styles.rejectRow}>
                <Text style={styles.rejectHint}>Sent to the applicant's record. Blank is sent as “No reason given”.</Text>
                <ConsoleButton
                  kind="ghost"
                  size="sm"
                  label="Cancel"
                  onPress={() => { setRejecting(false); setReason(''); }}
                />
              </View>
            </ConsoleCard>
          </FadeInUp>
        ) : null}

        {!!rejectionReason && (
          <View style={styles.reasonCard}>
            <Text style={styles.reasonEyebrow}>Rejection reason</Text>
            <Text style={styles.reasonText}>{rejectionReason}</Text>
          </View>
        )}

        {!!loadError && !isLoadingDetails && (
          <ConsoleNote
            kind="red"
            icon="cloud-off"
            text={loadError}
            action="Retry"
            onAction={fetchApplicationDetails}
          />
        )}
      </View>

      {/* Block → District → State: who has decided, and when. */}
      <ConsoleSectionTitle icon="timeline" title="Review trail" subtitle="Each tier gives its own verdict" />
      <FadeInUp delay={80} style={styles.gutter}>
        <ConsoleCard>
          <TierProgressRail app={trailSource} />
          <View style={styles.trailList}>
            {trail.map((step) => {
              const d = reviewDetail(step.tier);
              const by = ADMIN_TYPE[String(d?.adminType || '')] || '';
              const kind = step.decision === 'approved' ? 'approved' : step.decision === 'rejected' ? 'rejected' : 'pending';
              return (
                <View key={step.tier} style={styles.trailRow}>
                  <Text style={styles.trailTier}>{TIER_WORD[step.tier]}</Text>
                  <View style={styles.flexText}>
                    <Text style={styles.trailMeta} numberOfLines={2}>
                      {step.decision === 'pending'
                        ? 'No verdict yet'
                        : [step.at ? formatDate(step.at) : '', by ? `by ${by}` : '', d?.auto ? 'recorded automatically' : ''].filter(Boolean).join(' · ') || 'Decided'}
                    </Text>
                    {step.reason ? <Text style={styles.trailReason} numberOfLines={3}>{step.reason}</Text> : null}
                  </View>
                  <ConsoleChip label={step.decision === 'approved' ? 'Approved' : step.decision === 'rejected' ? 'Rejected' : 'Pending'} kind={kind} />
                </View>
              );
            })}
          </View>
        </ConsoleCard>
      </FadeInUp>

      {isLoadingDetails ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={PALETTE.indigo} />
          <Text style={styles.loadingText}>Loading full application data...</Text>
        </View>
      ) : null}

      {/* Collapsible form sections */}
      <ConsoleSectionTitle
        icon="description"
        title="Submitted forms"
        subtitle={`${visibleSections.length} section${visibleSections.length === 1 ? '' : 's'} with answers`}
        action={visibleSections.length ? (allOpen ? 'Collapse all' : 'Expand all') : undefined}
        onAction={() => setAll(!allOpen)}
      />
      <View style={[styles.gutter, styles.stack]}>
        {visibleSections.map((section, sIndex) => {
          const isOpen = expanded[section.key];
          const a = CONSOLE_ACCENTS[section.accent];
          return (
            <FadeInUp key={section.key} delay={100 + sIndex * 60}>
              <ConsoleCard padded={false}>
                <TouchableOpacity
                  style={styles.formHeader}
                  activeOpacity={0.75}
                  onPress={() => toggleSection(section.key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !!isOpen }}
                  accessibilityLabel={section.title}
                >
                  <LinearGradient colors={a.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.formIcon}>
                    <Icon name={section.icon} size={SIZE.icon} color={PALETTE.white} />
                  </LinearGradient>
                  <View style={styles.flexText}>
                    <Text style={styles.formTitle}>{section.title}</Text>
                    <Text style={styles.formSubtitle}>{section.subtitle} · {section.rows.length} field{section.rows.length === 1 ? '' : 's'}</Text>
                  </View>
                  <View style={[styles.chev, isOpen && { backgroundColor: a.soft }]}>
                    <Icon name={isOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={isOpen ? a.fg : PALETTE.textMuted} />
                  </View>
                </TouchableOpacity>

                {isOpen && (
                  <View style={styles.formBody}>
                    {section.rows.map((row, idx) => (
                      <View key={row.label + '_' + idx} style={[styles.detailRow, idx === section.rows.length - 1 && styles.detailRowLast]}>
                        <View style={[styles.detailIcon, { backgroundColor: a.soft }]}>
                          <Icon name={row.icon} size={15} color={a.fg} />
                        </View>
                        <View style={styles.flexText}>
                          <Text style={styles.detailLabel}>{row.label}</Text>
                          <Text style={styles.detailValue} selectable>{row.value}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ConsoleCard>
            </FadeInUp>
          );
        })}
      </View>

      {/* Uploaded documents, when the record carries any. */}
      {documents.length > 0 ? (
        <>
          <ConsoleSectionTitle icon="attach-file" title="Documents" subtitle={`${documents.length} uploaded with the application`} />
          <View style={styles.gutter}>
            <ConsoleCard padded={false}>
              {documents.map((doc, i) => (
                <TouchableOpacity
                  key={`${doc?.url || doc?.name}-${i}`}
                  style={[styles.docRow, i === documents.length - 1 && styles.detailRowLast]}
                  onPress={() => openDocument(doc)}
                  disabled={!doc?.url}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${doc?.name || 'document'}`}
                >
                  <View style={styles.docIcon}>
                    <Icon name={String(doc?.type || '').includes('pdf') ? 'picture-as-pdf' : 'insert-drive-file'} size={20} color={PALETTE.indigo} />
                  </View>
                  <View style={styles.flexText}>
                    <Text style={styles.detailValue} numberOfLines={1}>{doc?.name || 'Document'}</Text>
                    <Text style={styles.detailLabel} numberOfLines={1}>
                      {[doc?.type, doc?.uploadedAt ? formatDate(doc.uploadedAt) : ''].filter(Boolean).join(' · ') || 'Tap to open'}
                    </Text>
                  </View>
                  <Icon name="open-in-new" size={18} color={PALETTE.textFaint} />
                </TouchableOpacity>
              ))}
            </ConsoleCard>
          </View>
        </>
      ) : null}

      {isPending ? (
        <View style={styles.backLink}>
          <ConsoleButton kind="ghost" icon="format-list-bulleted" label="Back to List" onPress={() => navigation.goBack()} />
        </View>
      ) : null}
    </ConsoleScroll>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  gutter: { marginHorizontal: SPACE.lg },
  stack: { gap: SPACE.md, marginHorizontal: SPACE.lg },
  overlap: { marginTop: -30, marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  heroAvatar: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  facts: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.md, justifyContent: 'space-between' },
  fact: { width: '48%', flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  factWide: { width: '100%' },
  factIcon: { width: 30, height: 30, borderRadius: 10, backgroundColor: PALETTE.indigoSoft, alignItems: 'center', justifyContent: 'center' },
  factLabel: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13 },
  factValue: { ...TYPE.bodyStrong, fontSize: 13, lineHeight: 18, marginTop: 1 },
  fieldFlush: { marginBottom: 0 },
  rejectRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm },
  rejectHint: { ...TYPE.caption, flex: 1, minWidth: 0 },
  reasonCard: { padding: SPACE.lg, borderRadius: 18, backgroundColor: PALETTE.dangerSoft },
  reasonEyebrow: { ...TYPE.eyebrow, color: PALETTE.dangerText },
  reasonText: { ...TYPE.bodyStrong, color: PALETTE.dangerText, marginTop: SPACE.sm - 2 },
  trailList: { marginTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  trailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md - 2, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  trailTier: { width: 58, ...TYPE.label, fontWeight: '800', color: PALETTE.text },
  trailMeta: { ...TYPE.caption },
  trailReason: { ...TYPE.caption, color: PALETTE.dangerText, marginTop: 2 },
  loadingBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.sm, paddingTop: SPACE.lg },
  loadingText: { ...TYPE.caption },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, minHeight: SIZE.row + SPACE.lg },
  formIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  formTitle: { ...TYPE.subheading, fontWeight: '800' },
  formSubtitle: { ...TYPE.caption, marginTop: 1 },
  chev: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  formBody: {
    paddingHorizontal: SPACE.lg, paddingBottom: SPACE.xs,
    borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider,
  },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md, paddingVertical: SPACE.md - 2, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  detailRowLast: { borderBottomWidth: 0 },
  detailIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  detailLabel: { ...TYPE.caption, fontSize: 11 },
  detailValue: { ...TYPE.bodyStrong, marginTop: 1 },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg, borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  docIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: PALETTE.indigoSoft, alignItems: 'center', justifyContent: 'center' },
  backLink: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
});

export default ApplicantDetailScreen;
