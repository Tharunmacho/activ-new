import { useLegacyAppearance } from '../../../../ui/legacyAppearance';
import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Applicant } from '../../../../types';
import { resolveMediaUrl } from '../../../../config/api.config';
import {
  PALETTE, SPACE, TYPE, SIZE,
  ConsoleCard, ConsoleChip, ConsoleButton, TierProgressRail, GradientAvatar, PremiumInput,
} from '../../../../ui';
import { formatDate } from '../superTheme';

interface Props {
  applicant: Applicant;
  busy?: boolean;
  onPress?: (applicant: Applicant) => void;
  /** `reason` is the inline rejection reason (website ApplicantDecisionRow). */
  onReview?: (applicant: Applicant, action: 'approve' | 'reject', reason?: string) => void | Promise<void>;
}

/** The website's `stageFromStatus` fallback, for a payload with no `stage`. */
const stageFromStatus = (status: string): 'pending' | 'approved' | 'rejected' => {
  const st = String(status || '').toLowerCase();
  if (st.includes('reject')) return 'rejected';
  if (st.includes('approved') && !st.includes('pending')) return 'approved';
  return 'pending';
};

/**
 * An applicant card, laid out exactly like the one on the Block, District and
 * State dashboards — same avatar, badge, meta row, detail grid and action pair.
 * The super admin reviews the same record, so it should look the same.
 */
const ApplicantRow: React.FC<Props> = ({ applicant, busy, onPress, onReview }) => {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const a: any = applicant || {};
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  /*
   * WHETHER THIS ADMIN MAY DECIDE is the server's `canAct` (website
   * ApplicantDecisionRow) - never re-derived from the status. A row the caller
   * can act on reads "Pending" whatever the file's own status says; the stage
   * is only the fallback for an older payload without `canAct`.
   */
  const canAct = typeof a.canAct === 'boolean' ? a.canAct : (a.stage || stageFromStatus(a.status)) === 'pending';
  const stage = canAct ? 'pending' : (a.stage || stageFromStatus(a.status));
  const outcome = String(a.outcome || a.status || '');
  const enrolled = outcome === 'Approved';
  const declined = outcome === 'Rejected';
  const endorsementLine = String(a.endorsementLine || '');
  const recordedOnly = canAct && a.decidesOutcome === false;
  const waitingNote = !canAct && !!a.waitingOn && stage === 'pending';

  const badgeIcon = stage === 'pending' ? 'schedule'
    : stage === 'approved' ? 'check'
    : stage === 'rejected' ? 'close'
    : 'more-horiz';

  const photo = a.profilePhoto ? resolveMediaUrl(String(a.profilePhoto)) : '';

  const stripe = stage === 'approved' ? PALETTE.green : stage === 'rejected' ? PALETTE.red : PALETTE.amber;

  return (
    <ConsoleCard onPress={onPress ? () => onPress(applicant) : undefined} style={styles.card} accessibilityLabel={applicant?.fullName || 'Applicant'} accent={stripe}>
      <View style={styles.head}>
        <GradientAvatar name={applicant?.fullName} uri={photo} size={50} tone="admin" status={stage === 'pending' ? 'pending' : stage === 'approved' ? 'verified' : undefined} />
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={2}>
            {applicant?.fullName || 'Unnamed applicant'}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {applicant?.email || 'No email provided'}
          </Text>
          <Text style={styles.role} numberOfLines={1}>
            Role: <Text style={styles.roleValue}>{applicant?.role || 'member'}</Text>
          </Text>
        </View>
        <ConsoleChip
          label={stage === 'approved' ? 'Approved' : stage === 'rejected' ? 'Rejected' : 'Pending'}
          kind={stage === 'approved' ? 'approved' : stage === 'rejected' ? 'rejected' : 'pending'}
          icon={badgeIcon}
          style={styles.badge}
        />
      </View>

      {/* The OUTCOME, when this tier's verdict and the file's differ. */}
      {(enrolled && stage !== 'approved') || (declined && stage !== 'rejected') || waitingNote ? (
        <View style={styles.chipRow}>
          {enrolled && stage !== 'approved' ? (
            <ConsoleChip label="Member" icon="check-circle" kind="neutral" />
          ) : null}
          {declined && stage !== 'rejected' ? (
            <ConsoleChip label="Not admitted" icon="cancel" kind="neutral" />
          ) : null}
          {waitingNote ? (
            <ConsoleChip label="No admin in this region — with the Super Admin" icon="arrow-forward" kind="warning" />
          ) : null}
        </View>
      ) : null}

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Icon name="place" size={SIZE.iconSm} color={PALETTE.indigo} />
          <Text style={styles.metaText} numberOfLines={1}>
            {applicant?.block || applicant?.district || applicant?.state || '—'}
          </Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="phone" size={SIZE.iconSm} color={PALETTE.indigo} />
          <Text style={styles.metaText} numberOfLines={1}>{applicant?.phone || '—'}</Text>
        </View>
      </View>

      {/* Block → District → State, each tier's own verdict. */}
      <View style={styles.rail}>
        <TierProgressRail app={applicant} />
      </View>

      <View style={styles.facts}>
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Applied on</Text>
          <Text style={styles.factValue} numberOfLines={1}>{formatDate(applicant?.submittedAt) || '—'}</Text>
        </View>
        <View style={styles.factDivider} />
        <View style={styles.fact}>
          <Text style={styles.factLabel}>Membership Type</Text>
          <Text style={[styles.factValue, styles.cap]} numberOfLines={1}>{applicant?.memberType || applicant?.role || 'Member'}</Text>
        </View>
      </View>

      {endorsementLine || recordedOnly ? (
        <Text style={styles.endorsement}>
          {endorsementLine}
          {endorsementLine && recordedOnly ? ' · ' : ''}
          {recordedOnly ? 'Your decision is recorded for the file; the State Admin grants the membership' : ''}
        </Text>
      ) : null}

      {canAct && onReview && !rejecting ? (
        <View style={styles.actions}>
          <ConsoleButton
            kind="danger"
            size="sm"
            icon="close"
            label="Reject"
            disabled={busy}
            onPress={() => { setRejecting(v => !v); setReason(''); }}
            style={styles.flex}
          />
          <ConsoleButton
            kind="approve"
            size="sm"
            icon="check"
            label="Approve"
            loading={busy}
            onPress={() => onReview(applicant, 'approve')}
            style={styles.flex}
          />
        </View>
      ) : null}

      {/* Inline rejection reason - no native Modal inside a tab (CLAUDE.md Rule 2). */}
      {canAct && onReview && rejecting ? (
        <View style={styles.rejectBox}>
          <PremiumInput
            tone="admin"
            label="Reason for rejection"
            icon="edit-note"
            value={reason}
            onChangeText={setReason}
            placeholder="Why is this being rejected?"
            autoFocus
            multiline
            style={styles.fieldFlush}
          />
          <View style={styles.actions}>
            <ConsoleButton
              kind="soft"
              size="sm"
              label="Cancel"
              onPress={() => { setRejecting(false); setReason(''); }}
              style={styles.flex}
            />
            <ConsoleButton
              kind="dangerSolid"
              size="sm"
              icon="block"
              label="Confirm rejection"
              loading={busy}
              onPress={async () => {
                try {
                  await onReview(applicant, 'reject', reason);
                } finally {
                  setRejecting(false);
                  setReason('');
                }
              }}
              style={styles.flex}
            />
          </View>
        </View>
      ) : null}
    </ConsoleCard>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { marginBottom: SPACE.md },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  headText: { flex: 1, minWidth: 0 },
  name: { ...TYPE.subheading, fontWeight: '800' },
  email: { ...TYPE.caption, marginTop: SPACE.xxs },
  role: { ...TYPE.caption, marginTop: 1 },
  roleValue: { color: PALETTE.indigo, fontWeight: '700', textTransform: 'capitalize' },
  badge: { maxWidth: 110 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.md },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, marginTop: SPACE.md },
  metaItem: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: SPACE.sm - 2 },
  metaText: { flex: 1, minWidth: 0, ...TYPE.label, fontWeight: '600' },
  rail: { marginTop: SPACE.md, paddingVertical: SPACE.md, paddingHorizontal: SPACE.xs, borderRadius: 16, backgroundColor: PALETTE.indigoTint },
  facts: { flexDirection: 'row', alignItems: 'center', marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  fact: { flex: 1, minWidth: 0 },
  factDivider: { width: StyleSheet.hairlineWidth * 2, alignSelf: 'stretch', backgroundColor: PALETTE.divider, marginHorizontal: SPACE.md },
  factLabel: { ...TYPE.eyebrow, fontSize: 10, lineHeight: 13 },
  factValue: { ...TYPE.bodyStrong, marginTop: 2 },
  cap: { textTransform: 'capitalize' },
  endorsement: { ...TYPE.caption, lineHeight: 17, marginTop: SPACE.md, color: PALETTE.indigoDark, backgroundColor: PALETTE.indigoSoft, padding: SPACE.md - 2, borderRadius: 12, overflow: 'hidden', fontWeight: '600' },
  actions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.md },
  rejectBox: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider },
  fieldFlush: { marginBottom: 0 },
});

export default React.memo(ApplicantRow);

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_styles = styles;
