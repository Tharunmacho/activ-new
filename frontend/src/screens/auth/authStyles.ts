import { StyleSheet } from 'react-native';
import { PALETTE, RADIUS, SPACE, SHADOW, SIZE, TYPE } from '../../ui';

/**
 * The sign-in look, shared by the password-recovery, social sign-in and
 * welcome screens (the premium sheet's status panels and foot notes) and the
 * legacy AuthScreen shell, so they stay one design — exactly like the
 * website's /login and /admin/login.
 *
 * Kit tokens only (src/ui): no hex, no invented sizes. The components that use
 * these styles live in `authKit.tsx`.
 */
export const authStyles = StyleSheet.create({
  /* ---- canvas: content centred vertically on tall phones, scrolls on short ones */
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.xl,
    paddingBottom: SPACE.xxl,
  },
  scrollWithHeader: { flexGrow: 1, paddingBottom: SPACE.xxl },
  column: { width: '100%', maxWidth: 440, alignSelf: 'center' },
  columnUnderHeader: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm },
  columnCentered: { flexGrow: 1, justifyContent: 'center', paddingBottom: SPACE.xxl },

  /* ---- brand mark (logo unchanged: white disc, contained artwork) */
  brandWrap: { alignItems: 'center', marginBottom: SPACE.xl },
  brandCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: PALETTE.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
    ...SHADOW.card,
  },
  brandLogo: {
    // Source art is 899x277 (~3.25:1) — width drives the fit under `contain`
    width: 96,
    height: 32,
  },

  /* ---- heading block */
  header: { alignItems: 'center', marginBottom: SPACE.xl },
  title: { fontSize: 28, lineHeight: 35, fontWeight: '700', color: PALETTE.text, textAlign: 'center' },
  subtitle: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.xs },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: SPACE.xs,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    marginBottom: SPACE.md,
  },
  badgeText: { ...TYPE.eyebrow },

  /* ---- the form card */
  formCard: { padding: SPACE.xl },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: -SPACE.xs,
    marginBottom: SPACE.md,
  },

  /* ---- text links (44px targets) */
  link: { minHeight: SIZE.touch, justifyContent: 'center', alignItems: 'center', paddingHorizontal: SPACE.xs },
  linkText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },

  /* ---- "New to ACTIV? Create an account" */
  promptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACE.lg,
  },
  promptText: { ...TYPE.body, color: PALETTE.textMuted },

  /* ---- "OR SIGN IN WITH" */
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.lg, marginBottom: SPACE.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: PALETTE.border },
  dividerText: { ...TYPE.eyebrow, color: PALETTE.textFaint },

  socialRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: SPACE.lg },
  socialButton: {
    // Sized to the logo instead of stretching to a full third of the row
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: PALETTE.card,
    borderWidth: 1,
    borderColor: PALETTE.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.xs,
  },
  socialLogo: {
    // Source art is square 96x96 — square box keeps the marks at native proportions
    width: 24,
    height: 24,
  },

  /* ---- the link between the two sign-in screens (member ↔ admin) */
  portalRow: { alignItems: 'center', marginTop: SPACE.xl },
  portalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm - 2,
    maxWidth: '100%',
    paddingHorizontal: SPACE.lg,
    minHeight: SIZE.touch,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: PALETTE.card,
  },
  portalText: { ...TYPE.label, flexShrink: 1 },

  note: { fontSize: 14, lineHeight: 21, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.lg },

  /* ---- intro of a recovery step (icon tile + heading, left-aligned) */
  introIcon: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACE.lg,
  },
  introTitle: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: PALETTE.text },
  introText: { ...TYPE.body, color: PALETTE.textMuted, marginTop: SPACE.sm },

  /* ---- a finished / failed step (sent, changed, expired) */
  statusWrap: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACE.lg, paddingVertical: SPACE.xxl },
  statusHalo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: SPACE.xl,
  },
  statusIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statusTitle: { ...TYPE.display, fontSize: 24, lineHeight: 30, textAlign: 'center' },
  statusText: { ...TYPE.body, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.sm },
  statusActions: { marginTop: SPACE.xl, gap: SPACE.sm },
  statusStrong: { fontWeight: '700', color: PALETTE.text },

  footNote: { fontSize: 14, lineHeight: 21, color: PALETTE.textMuted, textAlign: 'center', marginTop: SPACE.sm },
});
