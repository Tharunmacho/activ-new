import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import { membershipValidityLabel } from '../../../utils/membershipDates';
import { isPastEvent as isPast } from '../../../utils/eventLifecycle';
import { useEventClock } from '../../../utils/useEventClock';
import React, { useCallback, useMemo, useState } from 'react';
import { AppState, View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PALETTE, SPACE, RADIUS, SIZE, TYPE, GRADIENTS, asArray, shortDate,
  PremiumScrollScreen, PREMIUM_OVERLAP, FadeInUp, PressableScale, GradientButton,
  PremiumCard, PremiumSectionHeader, GradientIconChip, ActionTile, ActionGrid, StatPill, StatRow, PremiumEmptyState,
  MemberBadge3D, ChipTone, FitImage } from '../../../ui';
import { GradientPanel } from '../dashboard/DashboardKit';
import {
  DashboardHeader, MembershipCard3D, PremiumDashboardSkeleton, greetingFor, greetingEmoji, todayLabel,
} from '../dashboard/DashboardPremium';
import ExploreActiv from '../dashboard/ExploreActiv';
import PlatinumMembershipCard, { PlatinumMemberShortcuts } from './PlatinumMembershipCard';
import {
  getMyProfile, getBusinessInfo, listMyCompanies, getMyApplications,
  listAnnouncements, listMemberEvents, formatApplicationRef, isPaidMember, getUnreadMessages,
} from '../../../services/memberApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { invalidateWebsiteContent } from '../../../services/websiteContent';
import { feedUnreadCount } from '../NotificationScreen';
import { useCategoryStyle } from '../updates/updateFormat';
import { clockTime, longDate } from '../events/eventFormat';
import { pickMostAdvancedApplication, resolveApplicantKind, planLabelFor } from '../dashboard/memberRules';
import RenewalBanner from '../dashboard/RenewalBanner';

/**
 * ============================================================================
 * THE PAID DASHBOARD — website `features/member/pages/PaidDashboard.tsx`
 * ============================================================================
 *
 * Identity (allSettled): getMyProfile · getBusinessInfo · getMyCompanies ·
 * getMyApplication; sections: announcements(6) · events.
 *
 * Real data only: Member ID = membershipNumber (ACTIV-YYYY-NNN), member since =
 * membershipActivatedAt || approvedAt, valid until = membershipExpiresAt (or a
 * year from activation for an annual row with no stored expiry — the website's
 * rule), Lifetime / Platinum never expire. Renewal banner only when the server
 * says `renewal.canRenew`. An unpaid member is sent to the unpaid dashboard.
 *
 * Premium layout: brand header (greeting with avatar and time of day) → the
 * membership as a 3D card with a light sweep → facts → stats → quick actions
 * → My Documents (+ View all) → Upcoming Events (poster, venue) → Explore
 * ACTIV → Association Updates → plan band → Platinum.
 */

const MONTHS3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function Fact({ label, value, icon, wide }: { label: string; value: string; icon: string; wide?: boolean }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    // `wide` for long identifiers: a half cell cut them mid-ID, and Android's
    // selectable text ignores numberOfLines and spilled under the button below.
    <View style={[styles.fact, wide && styles.factWide]}>
      <View style={styles.factLabelRow}>
        <Icon name={icon} size={12} color={PALETTE.textFaint} />
        <Text style={styles.factLabel} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={styles.factValue} numberOfLines={wide ? 2 : 1} selectable={!!wide}>{value || '—'}</Text>
    </View>
  );
}

/** A tappable row inside a padded={false} card: leading visual, text block, trailing. */
function Row({ onPress, last, children, accessibilityLabel }: {
  onPress: () => void; last?: boolean; children: React.ReactNode; accessibilityLabel?: string;
}) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} contentStyle={[styles.row, !last && styles.divider]} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {children}
    </PressableScale>
  );
}

const PaidDashboardScreen = ({ navigation }: any) => {
  const categoryStyle = useCategoryStyle();
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const { width } = useWindowDimensions();
  const eventCardWidth = Math.min(340, width - SPACE.lg * 2 - 24);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [hasBusinessRecord, setHasBusinessRecord] = useState(false);
  const [businessType, setBusinessType] = useState('');
  const [updates, setUpdates] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [bell, setBell] = useState(0);
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [exploreKey, setExploreKey] = useState(0);

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true);
    const [p, biz, comps, apps, ann, evs, alerts, messages] = await Promise.allSettled([
      getMyProfile(), getBusinessInfo(), listMyCompanies(), getMyApplications(),
      listAnnouncements({ limit: 6 }), listMemberEvents(), feedUnreadCount(), getUnreadMessages(),
    ]);
    const prof = p.status === 'fulfilled' ? p.value : null;
    if (prof && !isPaidMember(prof)) {
      navigation.reset({ index: 0, routes: [{ name: 'MemberMain' }] });
      return;
    }
    setProfile(prof);
    setApplication(apps.status === 'fulfilled' ? pickMostAdvancedApplication(apps.value) : null);
    let type = '';
    if (biz.status === 'fulfilled') {
      const info: any = biz.value || {};
      setHasBusinessRecord(!!info && (info.doingBusiness === true || !!info.organizationName));
      const types = asArray<string>(info?.businessTypes).filter(Boolean);
      if (types.length) type = types.join(', ');
    }
    if (!type && comps.status === 'fulfilled') {
      const first: any = asArray<any>(comps.value)[0];
      type = [first?.businessType, first?.constitutionType].map((v) => String(v || '').trim()).filter(Boolean).join(' · ');
    }
    setBusinessType(type);
    setUpdates(ann.status === 'fulfilled' ? asArray<any>(ann.value?.announcements) : []);
    setEvents(evs.status === 'fulfilled' ? asArray<any>(evs.value?.events) : []);
    if (alerts.status === 'fulfilled') setBell(alerts.value);
    if (messages.status === 'fulfilled') setUnreadMsgs(messages.value);
    setLoading(false);
    setRefreshing(false);
  }, [navigation]);

  useFocusEffect(useCallback(() => {
    load();
    let cancelled = false;
    let checking = false;
    const syncIdentity = async () => {
      if (checking || AppState.currentState !== 'active') return;
      checking = true;
      try { const latest = await getMyProfile(); if (!cancelled && latest) setProfile(latest); }
      catch { /* Keep the last known card while offline. */ }
      finally { checking = false; }
    };
    const timer = setInterval(syncIdentity, 30000);
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void syncIdentity(); });
    return () => { cancelled = true; clearInterval(timer); foreground.remove(); };
  }, [load]));

  const refresh = () => {
    invalidateWebsiteContent();
    setExploreKey((k) => k + 1);
    load('refresh');
  };

  const name = String(profile?.fullName || '').trim() || 'Member';
  const firstName = name.split(' ').filter(Boolean)[0] || 'Member';
  const memberId = String(profile?.membershipNumber || '');
  const applicationRef = formatApplicationRef(application);
  const membershipType = String(profile?.membershipType || '').trim();
  const memberSince = profile?.membershipActivatedAt || profile?.approvedAt || '';
  // Website isPlatinumProfile: case-insensitive.
  const platinum = String(profile?.membershipTier || '').trim().toLowerCase() === 'platinum';
  const lifetime = platinum || membershipType.toLowerCase() === 'lifetime';
  const paidKind = profile?.paidMembership?.kind;
  const planTitle = platinum ? 'Lifetime Membership' : (profile?.currentMembership?.planName || profile?.paidMembership?.planName || planLabelFor(['student', 'aspirant', 'business'].includes(paidKind) ? paidKind : resolveApplicantKind(application), hasBusinessRecord) || 'Member');
  const expiresAt = useMemo(() => {
    if (lifetime) return '';
    if (profile?.membershipExpiresAt) return profile.membershipExpiresAt;
    if (membershipType.toLowerCase() === 'annual' && memberSince) {
      const d = new Date(memberSince);
      if (!Number.isNaN(d.getTime())) { d.setFullYear(d.getFullYear() + 1); return d.toISOString(); }
    }
    return '';
  }, [lifetime, profile?.membershipExpiresAt, membershipType, memberSince]);

  const eventNow = useEventClock();
  const upcoming = useMemo(() => events.filter((e) => !isPast(e, eventNow))
    .sort((a, b) => (a?.startAt ? new Date(a.startAt).getTime() : 0) - (b?.startAt ? new Date(b.startAt).getTime() : 0)), [events, eventNow]);
  const myEventCount = useMemo(() => events.filter((e) => e?.myRegistration && e.myRegistration.status !== 'cancelled' && !isPast(e, eventNow)).length, [events, eventNow]);
  const block = String(profile?.block || '').trim();
  const district = String(profile?.district || '').trim();
  const state = String(profile?.state || '').trim();
  const abroad = profile?.isInternational === true;
  const photo = resolveMediaUrl(profile?.profilePhoto);
  const renewal = profile?.renewal || null;
  const statusLabel = String(profile?.membershipStatus || 'active').toUpperCase();
  const activeNow = String(profile?.membershipStatus || 'active').toLowerCase() === 'active';
  const hour = new Date().getHours();
  const validUntilLabel = membershipValidityLabel(expiresAt);
  const pinnedFirst = useMemo(() => [...updates].sort((a, b) => Number(!!b?.pinned) - Number(!!a?.pinned)), [updates]);

  const documents: { icon: string; label: string; detail: string; tone: ChipTone; verified?: boolean; go: () => void }[] = [
    { icon: 'workspace-premium', label: 'Membership Certificate', detail: 'View / download', tone: 'blue', verified: true, go: () => navigation.navigate('MemberCertificate', { kind: 'membership' }) },
    { icon: 'verified-user', label: 'Tax Exemption Certificate', detail: 'View / download', tone: 'green', verified: true, go: () => navigation.navigate('MemberCertificate', { kind: 'tax-exemption' }) },
    { icon: 'receipt-long', label: 'Payment Receipt', detail: 'View / download', tone: 'sky', go: () => navigation.navigate('PaymentSuccess', { orderId: profile?.paidMembership?.orderId }) },
    { icon: 'card-membership', label: 'Membership Plan', detail: platinum ? 'Lifetime Membership' : (planTitle || 'Your plan'), tone: 'amber', go: () => navigation.navigate('MembershipPlanDetails') },
  ];

  const header = (
    <DashboardHeader
      name={name}
      photo={photo}
      status={activeNow ? 'verified' : 'pending'}
      eyebrow={`${greetingFor(hour)} ${greetingEmoji(hour)} · ${todayLabel()}`}
      title={platinum ? `Welcome, ${firstName}` : `Hi, ${firstName} 👋`}
      subtitle={platinum ? 'Your Lifetime space. A lifetime with ACTIV.' : activeNow ? 'Your membership is active.' : `Membership ${statusLabel.toLowerCase()}`}
      art={platinum ? <View style={{ width: 72, height: 72, borderRadius: 36, borderWidth: 1, borderColor: '#d5e3ee90', backgroundColor: '#ffffff18', alignItems: 'center', justifyContent: 'center' }}><Icon name="workspace-premium" size={38} color="#e1eaf0" /></View> : <MemberBadge3D size={92} />}
      onMenu={() => navigation.navigate('MemberMenu')}
      onMessages={() => navigation.navigate('MemberMessages')}
      onBell={() => navigation.navigate('MemberNotifications')}
      messages={unreadMsgs}
      bell={bell}
    >
      <View style={{ height: SPACE.xl }} />
    </DashboardHeader>
  );

  return (
    <PremiumScrollScreen header={header} refreshing={refreshing} onRefresh={refresh}>
      {loading ? <PremiumDashboardSkeleton style={styles.overlap} /> : (
        <>
          {/* Keep the member's live counters directly below the greeting. */}
          <FadeInUp delay={60}>
            <StatRow style={{ marginTop: SPACE.md, marginBottom: SPACE.sm }}>
              <StatPill value={myEventCount} label="Events booked" icon="event-available" tone="rose" onPress={() => navigation.navigate('MemberEvents')} />
              <StatPill value={unreadMsgs} label="Unread messages" icon="chat" tone="blue" onPress={() => navigation.navigate('MemberMessages')} />
              <StatPill value={bell} label="New alerts" icon="notifications" tone="amber" onPress={() => navigation.navigate('MemberNotifications')} />
            </StatRow>
          </FadeInUp>
          {profile?.currentMembership?.message ? <PremiumCard style={styles.gutter}><Text accessibilityRole="header" style={styles.rowTitle}>Membership progression</Text><Text style={styles.rowSub}>{profile.currentMembership.message}</Text></PremiumCard> : null}
          {/* ---------------- upcoming events */}
          <PremiumSectionHeader
            title="Upcoming Events"
            subtitle={`Don't miss out on what's next${myEventCount ? ` · ${myEventCount} booked` : ''}`}
            action="See all"
            onAction={() => navigation.navigate('MemberEvents')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={eventCardWidth + SPACE.md} decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: SPACE.lg, gap: SPACE.md, paddingBottom: SPACE.sm, alignItems: 'stretch' }}>
            {upcoming.length ? upcoming.slice(0, 3).map((e, i) => {
              const d = e?.startAt ? new Date(e.startAt) : null;
              const valid = !!d && !Number.isNaN(d.getTime());
              const registered = e?.myRegistration && e.myRegistration.status !== 'cancelled';
              const banner = e?.bannerUrl ? resolveMediaUrl(e.bannerUrl) : '';
              const venue = [e?.venue, e?.district].map((v) => String(v || '').trim()).filter(Boolean).join(', ');
              return (
                <FadeInUp key={String(e?.id || i)} delay={i * 70} distance={10}>
                  <PremiumCard stretch
                    padded={false}
                    style={{ marginBottom: SPACE.md, width: eventCardWidth }}
                    onPress={() => navigation.navigate('MemberEventDetail', { id: String(e?.id || '') })}
                    accessibilityLabel={`${e?.title || 'Untitled event'}${venue ? `, ${venue}` : ''}`}
                  >
                    {banner ? (
                      <View style={styles.poster}>
                        <FitImage uri={banner} style={styles.posterImg} fit={e?.media?.fit === 'cover' ? 'cover' : 'contain'} accessibilityLabel={e?.bannerAlt || ''} />
                        <LinearGradient colors={['rgba(11,26,69,0)', 'rgba(11,26,69,0.65)']} style={styles.posterShade} />
                        {e?.category ? <View style={styles.posterCat}><Text style={styles.posterCatText} numberOfLines={1}>{String(e.category).toUpperCase()}</Text></View> : null}
                      </View>
                    ) : <LinearGradient colors={['#1E3A8A', '#3B82F6']} style={[styles.poster, { alignItems: 'center', justifyContent: 'center' }]}><Icon name="event" size={60} color="#FFFFFF" /></LinearGradient>}
                    <View style={styles.eventRow}>
                      <LinearGradient colors={['#1E3A8A', '#3B82F6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dateBox}>
                        <Text style={styles.dateDay} maxFontSizeMultiplier={1.2}>{valid && d ? String(d.getDate()).padStart(2, '0') : '--'}</Text>
                        <Text style={styles.dateMon} maxFontSizeMultiplier={1.2}>{valid && d ? MONTHS3[d.getMonth()] : 'TBC'}</Text>
                      </LinearGradient>
                      <View style={styles.rowText}>
                        {e?.category && !banner ? <Text style={styles.eventCat} numberOfLines={1}>{e.category}</Text> : null}
                        <Text style={styles.rowTitle} numberOfLines={2}>{e?.title || 'Untitled event'}</Text>
                        <View style={styles.metaLine}>
                          <Icon name="schedule" size={13} color={PALETTE.textMuted} />
                          <Text style={styles.rowSub} numberOfLines={1}>{e?.startAt ? clockTime(e.startAt) : 'Date to be confirmed'}</Text>
                        </View>
                        {venue ? (
                          <View style={styles.metaLine}>
                            <Icon name="place" size={13} color={PALETTE.textMuted} />
                            <Text style={styles.rowSub} numberOfLines={1}>{venue}</Text>
                          </View>
                        ) : null}
                      </View>
                      {registered ? (
                        <View style={styles.regPill}><Icon name="check" size={12} color={PALETTE.successText} /><Text style={styles.regText}>Registered</Text></View>
                      ) : <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />}
                    </View>
                  </PremiumCard>
                </FadeInUp>
              );
            }) : (
              <PremiumCard style={{ width: eventCardWidth }}>
                <PremiumEmptyState icon="event" title="Nothing scheduled yet" text="Events open to your membership will appear here." />
              </PremiumCard>
            )}
          </ScrollView>

          {/* ---------------- association updates */}
          <PremiumSectionHeader title="Association Updates" subtitle="Latest news & announcements" action="See all" onAction={() => navigation.navigate('AssociationUpdates')} />
          <PremiumCard padded={false} style={styles.gutter}>
            {pinnedFirst.length ? pinnedFirst.slice(0, 3).map((u, i, arr) => {
              const cat = categoryStyle(u?.category);
              const banner = u?.bannerUrl ? resolveMediaUrl(u.bannerUrl) : '';
              return (
                <Row
                  key={String(u?.id || i)}
                  last={i === arr.length - 1}
                  onPress={() => navigation.navigate('UpdateDetail', { id: String(u?.id || '') })}
                  accessibilityLabel={u?.title || 'Update'}
                >
                  {banner ? <FitImage uri={banner} style={styles.updThumb} /> : (
                    <GradientIconChip icon={u?.pinned ? 'push-pin' : 'campaign'} tone="amber" />
                  )}
                  <View style={styles.rowText}>
                    <Text style={[styles.updCat, { color: cat.fg }]} numberOfLines={1}>{String(cat.label || '').toUpperCase()}</Text>
                    <Text style={styles.rowTitle} numberOfLines={2}>{u?.title || 'Update'}</Text>
                    {u?.summary ? <Text style={styles.rowSub} numberOfLines={2}>{u.summary}</Text> : null}
                    {u?.publishedAt ? <Text style={styles.updDate}>{shortDate(u.publishedAt)}</Text> : null}
                  </View>
                  <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />
                </Row>
              );
            }) : (
              <PremiumEmptyState icon="campaign" title="No updates yet" text="Notices published for your region appear here first." />
            )}
          </PremiumCard>

          {/* ---------------- quick actions */}
          <PremiumSectionHeader title="Quick Actions" subtitle="Access your most used features" />
          <ActionGrid>
            <ActionTile icon="event-available" label="Register for Event" detail={myEventCount ? `${myEventCount} booked` : 'Book your seat'} tone="rose" onPress={() => navigation.navigate('MemberEvents')} />
            <ActionTile icon="manage-accounts" label="Update Profile" detail="Keep details current" tone="green" onPress={() => navigation.navigate('PaidProfile')} />
            <ActionTile icon="groups" label="Explore Directory" detail="Find fellow members" tone="blue" onPress={() => navigation.navigate('MemberDirectory')} />
            <ActionTile icon="inventory-2" label="View Products" detail="Your catalogue" tone="amber" onPress={() => navigation.navigate('ProductsServices', {})} />
          </ActionGrid>

          <ExploreActiv navigation={navigation} refreshKey={exploreKey} sections={['gallery']} showEmpty />
          <ExploreActiv navigation={navigation} refreshKey={exploreKey} sections={['news']} showEmpty />
          <ExploreActiv navigation={navigation} refreshKey={exploreKey} sections={['schemes', 'zones', 'nav']} />

          {/* ---------------- documents */}
          <PremiumSectionHeader
            title="My Documents"
            subtitle="Your important documents in one place"
            action="View all"
            onAction={() => navigation.navigate('MemberDocuments')}
            style={{ marginTop: SPACE.md }}
          />
          <PremiumCard padded={false} style={styles.gutter}>
            {documents.map((d, i) => (
              <Row key={d.label} onPress={d.go} last={i === documents.length - 1} accessibilityLabel={`${d.label}, ${d.detail}`}>
                <GradientIconChip icon={d.icon} tone={d.tone} />
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{d.label}</Text>
                  <View style={styles.metaLine}>
                    {d.verified ? (
                      <View style={styles.verified}><Icon name="verified" size={11} color={PALETTE.successText} /><Text style={styles.verifiedText}>Verified</Text></View>
                    ) : null}
                    <Text style={styles.rowSub}>{d.detail}</Text>
                  </View>
                </View>
                <Icon name="chevron-right" size={22} color={PALETTE.textFaint} />
              </Row>
            ))}
          </PremiumCard>

          {/* ---------------- membership card */}
          <FadeInUp delay={180} style={[styles.gutter, { marginTop: SPACE.xl }]}>
            {platinum ? <PlatinumMembershipCard name={name} memberId={memberId} since={shortDate(memberSince)} active={activeNow} onPress={() => navigation.navigate('MembershipPlanDetails')} /> : <MembershipCard3D
              name={name}
              photo={photo}
              planTitle={planTitle}
              subtitle={platinum ? 'Lifetime · never renews' : membershipType ? `${membershipType} membership` : 'Membership'}
              memberId={memberId}
              since={shortDate(memberSince)}
              validLabel={lifetime ? 'Validity' : 'Valid until'}
              validValue={lifetime ? 'Lifetime' : validUntilLabel}
              statusLabel={activeNow ? 'Active' : statusLabel}
              active={activeNow}
              platinum={platinum}
              onPress={() => navigation.navigate('MembershipPlanDetails')}
            />}
          </FadeInUp>

          {platinum && <View style={styles.gutter}><PlatinumMemberShortcuts onBusiness={() => navigation.navigate('BusinessDashboard')} onDocuments={() => navigation.navigate('MemberDocuments')} onReceipt={() => navigation.navigate('PaymentSuccess', { orderId: profile?.paidMembership?.orderId })} /></View>}

          {/* ---------------- the card's facts */}
          <FadeInUp delay={240}>
            <PremiumCard style={[styles.gutter, { marginTop: SPACE.md }]}>
              <View style={styles.factGrid}>
                {abroad ? (
                  <>
                    <Fact icon="place" label="Place" value={String(profile?.place || profile?.city || '')} />
                    <Fact icon="public" label="Country" value={String(profile?.country || '')} />
                  </>
                ) : (
                  <>
                    <Fact icon="place" label="State" value={state} />
                    <Fact icon="place" label="District" value={district} />
                    <Fact icon="place" label="Block" value={block} />
                  </>
                )}
                <Fact icon="work-outline" label="Business type" value={businessType} />
                <Fact icon="tag" label="Application ID" value={applicationRef} wide />
                {platinum ? <Fact icon="diamond" label="Tier" value="Lifetime Member" />
                  : lifetime ? <Fact icon="all-inclusive" label="Tier" value="Lifetime" /> : null}
              </View>
              <GradientButton
                label="View plan details"
                iconRight="chevron-right"
                variant="outline"
                onPress={() => navigation.navigate('MembershipPlanDetails')}
                style={{ marginTop: SPACE.lg }}
              />
            </PremiumCard>
          </FadeInUp>

          <RenewalBanner renewal={profile?.renewal} onRenew={() => navigation.navigate('MembershipPlans', { renew: true })} />

          {/* ---------------- More opportunities await (website closing band) */}
          <PremiumCard style={[styles.gutter, { marginTop: SPACE.xl }]}>
            <View style={styles.moreHead}>
              <GradientIconChip icon="auto-awesome" tone="blue" size={SIZE.touch} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.moreTitle}>More opportunities await</Text>
                <Text style={styles.rowSub}>Your membership is what opens them.</Text>
              </View>
            </View>
            <View style={styles.moreBlock}>
              <Text style={styles.moreLabel}>Your membership plan</Text>
              <View style={styles.moreRow}>
                <Text style={styles.moreValue}>{planTitle}</Text>
                <View style={styles.regPill}><Text style={styles.regText}>{statusLabel}</Text></View>
              </View>
              {validUntilLabel || lifetime ? (
                <>
                  <Text style={[styles.moreLabel, { marginTop: SPACE.md }]}>Next renewal</Text>
                  <Text style={styles.moreValue}>{lifetime ? 'No renewal needed' : validUntilLabel}</Text>
                  {!lifetime && renewal?.canRenew ? (
                    <GradientButton
                      label="Renew now"
                      icon="autorenew"
                      variant="outline"
                      onPress={() => navigation.navigate('MembershipPlans', { renew: true })}
                      style={{ alignSelf: 'flex-start', marginTop: SPACE.sm }}
                    />
                  ) : !lifetime && renewal?.opensAt ? (
                    <Text style={[styles.rowSub, { marginTop: SPACE.xs }]}>Renewal opens on {longDate(renewal.opensAt)}</Text>
                  ) : null}
                </>
              ) : null}
            </View>
            <GradientButton label="View plan details" iconRight="arrow-forward" onPress={() => navigation.navigate('MembershipPlanDetails')} style={{ marginTop: SPACE.lg }} />
          </PremiumCard>

          {/* ---------------- platinum invitation (website PlatinumShowcase) */}
          {!lifetime ? (
            <PremiumCard style={[styles.gutter, { marginTop: SPACE.xl }]}>
              <Text style={styles.moreTitle}>Upgrade your membership</Text>
              <Text style={[styles.rowSub, { marginTop: SPACE.sm }]}>Update your student, aspirant or business profile, then pay for your eligible plan using this same account.</Text>
              <GradientButton label="Review membership upgrade" onPress={() => navigation.navigate('MembershipPlans', { upgrade: true })} style={{ marginTop: SPACE.lg }} />
            </PremiumCard>
          ) : null}
          {!platinum ? (
            <PressableScale
              onPress={() => navigation.navigate('PlatinumRequest')}
              accessibilityRole="button"
              accessibilityLabel="Lifetime Membership. Ask the ACTIV office to call you."
              style={{ marginTop: SPACE.xl }}
              scaleTo={0.985}
            >
              <GradientPanel colors={GRADIENTS.platinum} padding={SPACE.lg}>
                <View style={styles.platRow}>
                  <View style={styles.platIcon}><Icon name="diamond" size={24} color={PALETTE.disabled} /></View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.platTitle}>Lifetime Membership</Text>
                    <Text style={styles.platText}>Membership for life. Ask the ACTIV office to call you.</Text>
                  </View>
                  <Icon name="chevron-right" size={22} color={PALETTE.disabled} />
                </View>
              </GradientPanel>
            </PressableScale>
          ) : null}
          <ExploreActiv navigation={navigation} refreshKey={exploreKey} sections={['contact', 'legal']} />
        </>
      )}
    </PremiumScrollScreen>
  );
};

const styles = StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  overlap: { marginTop: -PREMIUM_OVERLAP },

  factGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: SPACE.lg },
  fact: { width: '50%', paddingRight: SPACE.sm },
  factWide: { width: '100%', paddingRight: 0 },
  factLabelRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  factLabel: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13, flexShrink: 1 },
  factValue: { ...TYPE.bodyStrong, marginTop: SPACE.xs, fontVariant: ['tabular-nums'] },

  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, minHeight: SIZE.row + 8 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...TYPE.subheading },
  rowSub: { ...TYPE.caption, fontWeight: '400', flexShrink: 1 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth * 2, borderBottomColor: PALETTE.divider },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xxs },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: PALETTE.successSoft, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  verifiedText: { fontSize: 10.5, fontWeight: '800', color: PALETTE.successText },

  poster: { height: 132, borderTopLeftRadius: 21, borderTopRightRadius: 21, overflow: 'hidden', backgroundColor: PALETTE.field },
  posterImg: { width: '100%', height: '100%' },
  posterShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 60 },
  posterCat: { position: 'absolute', left: SPACE.md, bottom: SPACE.sm, backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: SPACE.sm, paddingVertical: 2, maxWidth: '70%' },
  posterCatText: { fontSize: 10, lineHeight: 14, fontWeight: '800', color: PALETTE.white, letterSpacing: 0.8 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md },
  dateBox: { width: 52, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontSize: 20, lineHeight: 24, fontWeight: '800', color: PALETTE.white, fontVariant: ['tabular-nums'] },
  dateMon: { fontSize: 10, lineHeight: 13, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1 },
  eventCat: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13, marginBottom: SPACE.xxs },
  regPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: PALETTE.successSoft, borderRadius: 999, paddingHorizontal: SPACE.sm, minHeight: 24 },
  regText: { fontSize: 11, fontWeight: '800', color: PALETTE.successText },

  updThumb: { width: SIZE.iconChip + 16, height: SIZE.iconChip + 2, borderRadius: RADIUS.sm, backgroundColor: PALETTE.field },
  updCat: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13, marginBottom: SPACE.xxs },
  updDate: { fontSize: 11, lineHeight: 15, color: PALETTE.textFaint, marginTop: SPACE.xs },


  moreHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  moreTitle: { ...TYPE.heading, fontSize: 17, lineHeight: 23 },
  moreBlock: { marginTop: SPACE.lg, padding: SPACE.lg, borderRadius: 18, backgroundColor: PALETTE.blueTint, borderWidth: 1, borderColor: PALETTE.primarySoft },
  moreLabel: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13 },
  moreRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.xs },
  moreValue: { ...TYPE.subheading, flexShrink: 1 },

  platRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  platIcon: { width: SIZE.touch, height: SIZE.touch, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  platTitle: { ...TYPE.subheading, color: PALETTE.white },
  platText: { ...TYPE.caption, fontWeight: '400', color: 'rgba(255,255,255,0.8)', marginTop: SPACE.xxs },
});

export default PaidDashboardScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
