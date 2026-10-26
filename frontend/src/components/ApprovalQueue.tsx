import { useLegacyAppearance } from '../ui/legacyAppearance';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Applicant, ApplicantBuckets, AdminLevel, normalizeApplicationStatus } from '../types';
import { resolveMediaUrl } from '../config/api.config';
import {
  PALETTE, SPACE, TYPE, SIZE,
  ConsoleCard, ConsoleChip, ConsoleTabs, ConsoleButton, ConsoleState, TierProgressRail, GradientAvatar,
  PremiumInput, FadeInUp, consoleStageKind,
} from '../ui';

type FilterKey = keyof ApplicantBuckets;

interface Props {
  buckets: ApplicantBuckets;
  /** Which tier is reviewing — drives copy and the empty-state explanation. */
  level: AdminLevel;
  /** Resolves once the decision has been persisted; the parent then refetches. */
  onReview: (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => Promise<void>;
  onPressApplicant?: (applicant: Applicant) => void;
  activeFilter?: FilterKey;
  onFilterChange?: (filter: FilterKey) => void;
}

const FILTER_TABS: { key: FilterKey; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

/*
 * Why a queue is empty is more useful than the fact that it is.
 *
 * Every admin sees every application in their own patch from the moment it is
 * submitted, so an empty queue means one thing: nobody has applied, or
 * everything has been dealt with.
 */
const LEVEL_COPY: Record<AdminLevel, { title: string; waitingOn: string }> = {
  block: {
    title: 'Block Approvals',
    waitingOn: 'Every application from your block, from the moment it is submitted.',
  },
  district: {
    title: 'District Approvals',
    waitingOn: 'Every application from your district, from the moment it is submitted.',
  },
  state: {
    title: 'State Approvals',
    waitingOn: 'Every application from your state, from the moment it is submitted.',
  },
};

/** Quick fills for the reason field — the admin can still type anything. */
const QUICK_REASONS = ['Incomplete application details', 'Applicant is outside this region', 'Duplicate application'];

const STRIPE: Record<string, string> = { pending: PALETTE.amber, approved: PALETTE.green, rejected: PALETTE.red };

const ApprovalQueue: React.FC<Props> = ({
  buckets,
  level,
  onReview,
  onPressApplicant,
  activeFilter: controlledFilter,
  onFilterChange,
}) => {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const [internalFilter, setInternalFilter] = useState<FilterKey>('pending');
  const activeFilter = controlledFilter ?? internalFilter;
  const setActiveFilter = (f: FilterKey) => {
    setInternalFilter(f);
    if (onFilterChange) onFilterChange(f);
  };
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'approve' | 'reject' | null>(null);
  // Inline rejection form rather than a native Modal: this queue renders inside
  // sub-tab views, where a transparent Modal risks a WindowManager crash.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const safeBuckets = useMemo<ApplicantBuckets>(
    () => ({
      pending: buckets?.pending || [],
      approved: buckets?.approved || [],
      rejected: buckets?.rejected || [],
      all: buckets?.all || [],
    }),
    [buckets],
  );

  const visible = safeBuckets[activeFilter] || [];
  const copy = LEVEL_COPY[level] || LEVEL_COPY.block;

  const submit = useCallback(
    async (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => {
      setBusyId(applicant?.id || '');
      setBusyAction(action);
      try {
        await onReview(applicant, action, reason);
        setRejectingId(null);
        setRejectReason('');
      } finally {
        setBusyId(null);
        setBusyAction(null);
      }
    },
    [onReview],
  );

  const renderCard = (applicant: Applicant, index: number) => {
    const stage = applicant?.stage || 'pending';
    const isBusy = busyId === (applicant?.id || '');
    /*
     * THIS TIER'S OWN VERDICT IS THE WHOLE TEST — not "has anybody decided".
     *
     * The three tiers hold three separate verdicts. `canAct` is the server's
     * answer; the stage fallback is the same answer for this tier and covers an
     * older payload.
     */
    const canAct = applicant?.canAct ?? (stage === 'pending');
    const isRejecting = rejectingId === (applicant?.id || '');

    /*
     * The APPLICATION's outcome, which the chip above does not report. Only the
     * State's approval enrols anybody, so a block admin's own "Approved" chip
     * says nothing about whether this person is a member.
     */
    const outcome = String(applicant?.outcome || applicant?.status || '');
    const enrolled = normalizeApplicationStatus(outcome) === 'Approved';
    const declined = normalizeApplicationStatus(outcome) === 'Rejected';
    const endorsement = String(applicant?.endorsementLine || '');
    const grantsMembership = applicant?.decidesOutcome !== false;

    const context = [
      endorsement,
      enrolled && stage !== 'approved' ? 'Approved — the member profile exists' : '',
      declined && stage !== 'rejected' ? 'The State Admin rejected this application' : '',
      canAct && !grantsMembership
        ? 'Your decision is recorded for the file; the State Admin grants the membership'
        : '',
    ].filter(Boolean).join(' · ');

    // An applicant from abroad has no block or district; the website names the
    // country and place instead (ApprovalQueue.tsx, `abroad`).
    const extra: any = applicant || {};
    const abroad = extra?.isInternational === true;
    const location = abroad
      ? ['Outside India', extra?.place, extra?.country].filter(Boolean).join(' · ')
      : [applicant?.block, applicant?.district].filter(Boolean).join(', ');
    const appliedOn = (() => {
      const d = applicant?.submittedAt ? new Date(applicant.submittedAt) : null;
      return d && !isNaN(d.getTime())
        ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—';
    })();

    const declaredKind = String(applicant?.registrationType || applicant?.memberType || applicant?.role || '').toLowerCase();
    const isStudent = declaredKind.includes('student');
    const isAsp =
      isStudent ||
      applicant?.doingBusiness === false ||
      applicant?.businessInfo?.doingBusiness === false ||
      declaredKind.includes('aspirant');
    const displayRole = isStudent
      ? 'Student'
      : isAsp
      ? 'Aspirant'
      : (applicant?.doingBusiness === true || applicant?.businessInfo?.doingBusiness === true || applicant?.organizationName
          ? 'Business Member'
          : (applicant?.role && String(applicant.role || '').toLowerCase() !== 'member' ? applicant.role : 'Business Member'));

    const photoPath = String(extra?.profilePhoto || '');
    const photo = photoPath ? resolveMediaUrl(photoPath) : '';
    const memberType = String(applicant?.memberType || applicant?.role || 'Member');
    const memberTypeLabel = memberType ? memberType.charAt(0).toUpperCase() + memberType.slice(1) : 'Member';

    return (
      <FadeInUp key={applicant?.id || applicant?.applicationId || index} delay={Math.min(index, 6) * 50}>
        <ConsoleCard
          onPress={onPressApplicant ? () => onPressApplicant(applicant) : undefined}
          accessibilityLabel={`${applicant?.fullName || 'Applicant'}, ${applicant?.statusLabel || 'Pending'}`}
          accent={STRIPE[stage] || PALETTE.amber}
        >
          <View style={styles.cardHeader}>
            <GradientAvatar
              name={applicant?.fullName}
              uri={photo}
              size={AVATAR}
              tone="admin"
              status={stage === 'pending' ? 'pending' : stage === 'approved' ? 'verified' : undefined}
            />
            <View style={styles.headerText}>
              <Text style={styles.name} numberOfLines={2}>
                {applicant?.fullName || 'Name not provided'}
              </Text>
              {!!applicant?.email && (
                <Text style={styles.email} numberOfLines={1}>
                  {applicant.email}
                </Text>
              )}
              <ConsoleChip
                label={applicant?.statusLabel || 'Pending'}
                kind={consoleStageKind(stage)}
                style={styles.chip}
              />
            </View>
            {onPressApplicant ? <Icon name="chevron-right" size={22} color={PALETTE.textFaint} /> : null}
          </View>

          {/* Only what the applicant actually submitted. An admin deciding on a
              membership must never see a fabricated phone number or location. */}
          <View style={styles.metaList}>
            <View style={styles.metaRow}>
              <View style={[styles.metaIcon, { backgroundColor: isAsp ? PALETTE.successSoft : PALETTE.indigoSoft }]}>
                <Icon name={isAsp ? 'school' : 'business-center'} size={14} color={isAsp ? PALETTE.successText : PALETTE.indigo} />
              </View>
              <Text style={[styles.metaValue, { color: isAsp ? PALETTE.successText : PALETTE.indigo, fontWeight: '700' }]} numberOfLines={1}>
                {displayRole}
              </Text>
            </View>
            {!!location && (
              <View style={styles.metaRow}>
                <View style={styles.metaIcon}><Icon name="location-on" size={14} color={PALETTE.textMuted} /></View>
                <Text style={styles.metaValue} numberOfLines={2}>{location}</Text>
              </View>
            )}
            {!!applicant?.phone && (
              <View style={styles.metaRow}>
                <View style={styles.metaIcon}><Icon name="call" size={14} color={PALETTE.textMuted} /></View>
                <Text style={styles.metaValue} selectable>{applicant.phone}</Text>
              </View>
            )}
          </View>

          {/* The three verdicts, Block → District → State, with this seat ringed. */}
          <View style={styles.rail}>
            <TierProgressRail app={applicant} you={level} />
          </View>

          {/* Applied on / Membership Type — how long a file has waited and what
              kind of member it is, without opening it (website parity). */}
          <View style={styles.facts}>
            <View style={styles.fact}>
              <Text style={styles.factLabel}>Applied on</Text>
              <Text style={styles.factValue} numberOfLines={1}>{appliedOn}</Text>
            </View>
            <View style={styles.factDivider} />
            <View style={styles.fact}>
              <Text style={styles.factLabel}>Membership type</Text>
              <Text style={styles.factValue} numberOfLines={1}>{memberTypeLabel}</Text>
            </View>
          </View>

          {/* Nobody at any tier covers this region, so it will sit here until the
              Super Admin clears it or somebody is appointed. */}
          {!!applicant?.orphaned && !!applicant?.fallbackReason && (
            <View style={styles.escalation}>
              <Icon name="trending-up" size={SIZE.iconSm} color={PALETTE.warningText} />
              <Text style={styles.escalationText}>
                {applicant.fallbackReason}
              </Text>
            </View>
          )}

          {!!applicant?.approvedByText && (
            <View style={styles.attributionRow}>
              <Icon name={stage === 'rejected' ? 'gpp-bad' : 'verified'} size={15} color={stage === 'rejected' ? PALETTE.dangerText : PALETTE.indigo} />
              <Text style={[styles.attribution, stage === 'rejected' && { color: PALETTE.dangerText }]}>
                {applicant.approvedByText}
              </Text>
            </View>
          )}

          {!!context && (
            <Text style={styles.context}>
              {context}
            </Text>
          )}

          {!!applicant?.rejectionReason && stage !== 'pending' && (
            <View style={styles.reason}>
              <Text style={styles.reasonLabel}>Reason</Text>
              <Text style={styles.reasonText}>{applicant.rejectionReason}</Text>
            </View>
          )}

          {canAct && !isRejecting && (
            <View style={styles.actions}>
              <ConsoleButton
                kind="danger"
                size="sm"
                icon="close"
                label="Reject"
                disabled={isBusy}
                onPress={() => {
                  setRejectingId(applicant?.id || '');
                  setRejectReason('');
                }}
                style={styles.actionBtn}
              />
              <ConsoleButton
                kind="approve"
                size="sm"
                icon="check"
                label="Approve"
                loading={isBusy && busyAction === 'approve'}
                disabled={isBusy && busyAction !== 'approve'}
                onPress={() => submit(applicant, 'approve')}
                style={styles.actionBtn}
              />
            </View>
          )}

          {/* Inline, never a native Modal — this queue lives inside tabs (Rule 2). */}
          {canAct && isRejecting && (
            <View style={styles.rejectForm}>
              <PremiumInput
                tone="admin"
                label="Reason for rejection"
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Explain why this application is being rejected"
                multiline
                icon="edit-note"
                style={styles.fieldFlush}
              />
              <View style={styles.quick}>
                {QUICK_REASONS.map((q) => (
                  <TouchableOpacity
                    key={q}
                    onPress={() => setRejectReason((prev) => ((prev || '').trim() ? `${(prev || '').trim()}. ${q}` : q))}
                    style={styles.quickChip}
                    accessibilityRole="button"
                    accessibilityLabel={`Use reason: ${q}`}
                  >
                    <Icon name="add" size={13} color={PALETTE.indigo} />
                    <Text style={styles.quickText} numberOfLines={1}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.actions}>
                <ConsoleButton
                  kind="soft"
                  size="sm"
                  label="Cancel"
                  disabled={isBusy}
                  onPress={() => {
                    setRejectingId(null);
                    setRejectReason('');
                  }}
                  style={styles.actionBtn}
                />
                <ConsoleButton
                  kind="dangerSolid"
                  size="sm"
                  icon="block"
                  label="Confirm Reject"
                  loading={isBusy && busyAction === 'reject'}
                  onPress={() => submit(applicant, 'reject', (rejectReason || '').trim())}
                  style={styles.actionBtn}
                />
              </View>
            </View>
          )}
        </ConsoleCard>
      </FadeInUp>
    );
  };

  const tabs = FILTER_TABS.map((tab) => ({
    value: tab.key,
    label: tab.label,
    count: (safeBuckets[tab.key] || []).length,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle} accessibilityRole="header" numberOfLines={1}>{copy.title}</Text>
        <View style={styles.countPill}>
          <Text style={styles.sectionCount}>{visible.length} shown</Text>
        </View>
      </View>

      {/* Equal-width track: all four fit side by side at 360dp (Rule 4). */}
      <ConsoleTabs
        options={tabs}
        value={activeFilter}
        onChange={(v) => setActiveFilter(v as FilterKey)}
        scrollable={false}
      />

      <View style={styles.list}>
        {visible.length > 0 ? (
          visible.map(renderCard)
        ) : (
          <ConsoleCard>
            <ConsoleState
              title={`No ${activeFilter === 'all' ? '' : `${activeFilter} `}applications`}
              message={activeFilter === 'pending' ? copy.waitingOn : 'Nothing to show in this bucket yet.'}
            />
          </ConsoleCard>
        )}
      </View>
    </View>
  );
};

const AVATAR = 52;

const styles = StyleSheet.create({
  container: { paddingTop: SPACE.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: SPACE.lg, marginBottom: SPACE.md, gap: SPACE.sm },
  sectionTitle: { ...TYPE.heading, fontSize: 17, flexShrink: 1 },
  countPill: { paddingHorizontal: SPACE.md - 2, paddingVertical: 4, borderRadius: 999, backgroundColor: PALETTE.indigoSoft },
  sectionCount: { ...TYPE.caption, fontWeight: '700', color: PALETTE.indigoDark },
  list: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.md, gap: SPACE.md },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  headerText: { flex: 1, minWidth: 0 },
  name: { ...TYPE.subheading, fontWeight: '800', fontSize: 16 },
  email: { ...TYPE.caption, marginTop: SPACE.xxs },
  chip: { marginTop: SPACE.sm - 2 },

  metaList: { marginTop: SPACE.md, gap: SPACE.sm - 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  metaIcon: { width: 26, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.divider },
  metaValue: { ...TYPE.label, flex: 1, minWidth: 0 },

  rail: {
    marginTop: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xs, borderRadius: 16,
    backgroundColor: PALETTE.indigoTint,
  },

  facts: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  fact: { flex: 1, minWidth: 0 },
  factDivider: { width: StyleSheet.hairlineWidth * 2, alignSelf: 'stretch', backgroundColor: PALETTE.divider, marginHorizontal: SPACE.md },
  factLabel: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13 },
  factValue: { ...TYPE.bodyStrong, marginTop: 2 },

  escalation: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, marginTop: SPACE.md,
    paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, borderRadius: 12, backgroundColor: PALETTE.warningSoft,
  },
  escalationText: { flex: 1, minWidth: 0, ...TYPE.caption, color: PALETTE.warningText },
  attributionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACE.md },
  attribution: { flex: 1, minWidth: 0, ...TYPE.caption, fontWeight: '700', color: PALETTE.indigo },
  context: { marginTop: SPACE.xs, ...TYPE.caption, lineHeight: 17 },
  reason: { marginTop: SPACE.sm, padding: SPACE.md, borderRadius: 12, backgroundColor: PALETTE.dangerSoft },
  reasonLabel: { ...TYPE.eyebrow, color: PALETTE.dangerText, marginBottom: SPACE.xxs },
  reasonText: { ...TYPE.caption, color: PALETTE.dangerText },

  actions: { flexDirection: 'row', marginTop: SPACE.md, gap: SPACE.sm },
  actionBtn: { flex: 1 },
  rejectForm: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  fieldFlush: { marginBottom: 0 },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.sm },
  quickChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%', minHeight: 32,
    paddingHorizontal: SPACE.sm + 2, borderRadius: 999, backgroundColor: PALETTE.indigoSoft,
  },
  quickText: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: PALETTE.indigoDark, flexShrink: 1 },
});

export default ApprovalQueue;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_styles = styles;
