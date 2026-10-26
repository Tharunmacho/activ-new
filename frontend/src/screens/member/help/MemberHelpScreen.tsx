import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Notice, PALETTE, SPACE, SIZE, TYPE, asArray, errorText, BRAND,
  PremiumPage, PremiumPageHeader, PREMIUM_OVERLAP, SupportHeadset3D, PremiumSection, PremiumInput,
  SurfaceCard, GradientGlyph, GroupTitle, GradientButton, FadeInUp, PressableScale,
} from '../../../ui';
import type { GlyphTone } from '../../../ui';
import {
  getContactInfo, getMyProfile, getMyApplications, formatApplicationRef, sendHelpMessage,
} from '../../../services/memberApi';
import { pickMostAdvancedApplication } from '../dashboard/memberRules';

/**
 * Help & Support — website `features/member/pages/MemberHelp.tsx`.
 *
 *   GET  /cms/contact-info          the association's own contact block
 *                                   (hours, email, phone, alternatePhone, address, mapLink)
 *   GET  /members/my-profile        prefills name / email / phone
 *   GET  /applications/my-applications  the application reference
 *   POST /cms/contact-messages      { name, email, phone, subject, message, applicationRef }
 *        subject = "<subject or 'Member support request'> (Application <ref>)" — the
 *        website's exact composition, so the office inbox reads the same either way.
 */

const FAQ = [
  {
    icon: 'fact-check',
    question: 'How long does the review take?',
    answer: 'Your Block, District and State Admins — the admins for your own region — review your '
      + 'application at the same time, and the State Admin gives the final decision. The '
      + 'Application Status screen shows each of their answers as it is recorded.',
  },
  {
    icon: 'credit-card',
    question: 'When do I pay, and what does it unlock?',
    answer: 'Payment opens once the State Admin has approved your application — not before. '
      + 'Activating unlocks direct messages and member connections, members-only notices, '
      + 'and your membership and tax exemption certificates.',
  },
  {
    icon: 'event',
    question: 'Can I attend events before my membership is active?',
    answer: 'Yes. The events programme is open to you now and you can register for a seat from '
      + 'any event page. Events the association marks as members-only are the exception, '
      + 'and those appear once your membership is active.',
  },
  {
    icon: 'manage-accounts',
    question: 'Can I still change my details?',
    answer: 'Your details are edited in My Profile. Once your application is submitted its forms '
      + 'lock, so a correction then needs the office team — send the change below and it '
      + 'reaches them with your application reference.',
  },
];

const digits = (v: string) => String(v || '').replace(/[^\d+]/g, '');

/** A one-tap contact tile (Call / WhatsApp / Email). */
function QuickTile({ icon, label, detail, colors, tone, onPress }: {
  icon: string; label: string; detail: string; colors?: string[]; tone?: GlyphTone; onPress: () => void;
}) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <PressableScale
      onPress={onPress}
      style={styles.quickWrap}
      contentStyle={styles.quick}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${detail}`}
    >
      <GradientGlyph icon={icon} colors={colors} tone={tone} size={44} />
      <Text style={styles.quickLabel} numberOfLines={1} maxFontSizeMultiplier={1.2}>{label}</Text>
      <Text style={styles.quickDetail} numberOfLines={1} maxFontSizeMultiplier={1.2}>{detail}</Text>
    </PressableScale>
  );
}

function DetailRow({ icon, tone, label, lines, onPress, actionIcon = 'open-in-new', last }: {
  icon: string; tone: GlyphTone; label: string; lines: string[]; onPress?: () => void; actionIcon?: string; last?: boolean;
}) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const body = (
    <View style={[styles.detailRow, !last && styles.divider]}>
      <GradientGlyph icon={icon} tone={tone} size={40} />
      <View style={styles.flexMin}>
        <Text style={styles.detailLabel}>{label}</Text>
        {(lines || []).map((l, i) => (
          <Text key={`${l}-${i}`} style={[styles.detailValue, onPress && { color: PALETTE.blue }]} selectable>{l}</Text>
        ))}
      </View>
      {onPress ? <Icon name={actionIcon} size={SIZE.iconSm + 2} color={PALETTE.textFaint} /> : null}
    </View>
  );
  return onPress ? (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} accessibilityRole="link" accessibilityLabel={`${label}: ${(lines || []).join(', ')}`}>{body}</TouchableOpacity>
  ) : body;
}

function Faq({ item, open, onToggle, last }: { item: typeof FAQ[number]; open: boolean; onToggle: () => void; last?: boolean }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={[styles.faq, !last && styles.divider, open && styles.faqOpen]}>
      <TouchableOpacity onPress={onToggle} style={styles.faqHead} activeOpacity={0.7} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <GradientGlyph icon={item.icon} tone={open ? 'blue' : 'sky'} size={40} />
        <Text style={[styles.faqQ, open && { color: BRAND.navy }]} maxFontSizeMultiplier={1.3}>{item.question}</Text>
        <View style={[styles.chev, open && styles.chevOpen]}>
          <Icon name={open ? 'expand-less' : 'expand-more'} size={SIZE.iconLg} color={open ? PALETTE.white : PALETTE.textMuted} />
        </View>
      </TouchableOpacity>
      {open ? (
        <FadeInUp distance={6} duration={260}>
          <Text style={styles.faqA} maxFontSizeMultiplier={1.3}>{item.answer}</Text>
        </FadeInUp>
      ) : null}
    </View>
  );
}

const MemberHelpScreen = ({ navigation }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const [contact, setContact] = useState<any>(null);
  const [appRef, setAppRef] = useState('');
  const [open, setOpen] = useState('');
  const [form, setForm] = useState({ name: '', email: '', phone: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState('');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getContactInfo(), getMyProfile(), getMyApplications()]).then(([info, profile, apps]) => {
      if (cancelled) return;
      if (info.status === 'fulfilled') setContact(info.value);
      if (apps.status === 'fulfilled') setAppRef(formatApplicationRef(pickMostAdvancedApplication(apps.value)));
      if (profile.status === 'fulfilled' && profile.value) {
        const me: any = profile.value;
        setForm((cur) => ({
          ...cur,
          name: cur.name || String(me?.fullName || ''),
          email: cur.email || String(me?.email || ''),
          phone: cur.phone || String(me?.phoneNumber || me?.phone || ''),
        }));
      }
    });
    return () => { cancelled = true; };
  }, []);

  const hours = asArray<string>(contact?.workingHours).filter(Boolean);
  const address = asArray<string>(contact?.addressLines).filter(Boolean);
  const email = String(contact?.email || '');
  const phone = String(contact?.phone || '');
  const altPhone = String(contact?.alternatePhone || '');
  const mapLink = String(contact?.mapLink || '');
  const hasDetails = hours.length > 0 || !!email || !!phone || !!altPhone || address.length > 0;

  const set = (key: keyof typeof form) => (v: string) => {
    setForm((cur) => ({ ...cur, [key]: v }));
    setFormError('');
    setSent('');
  };

  const submit = async () => {
    const name = (form.name || '').trim();
    const mail = (form.email || '').trim();
    const message = (form.message || '').trim();
    if (!name || !mail || !message) {
      setFormError('Your name, email and a message are needed');
      return;
    }
    setSending(true);
    setFormError('');
    try {
      await sendHelpMessage({
        name,
        email: mail,
        phone: (form.phone || '').trim(),
        subject: [(form.subject || '').trim() || 'Member support request', appRef ? `(Application ${appRef})` : ''].filter(Boolean).join(' '),
        message,
        applicationRef: appRef || '',
      });
      setSent('Your message has reached the ACTIV office. The team will reply to your email.');
      setForm((cur) => ({ ...cur, subject: '', message: '' }));
    } catch (err) {
      setFormError(errorText(err, 'Your message could not be sent'));
    } finally {
      setSending(false);
    }
  };

  const openUrl = async (url: string, fallback: string) => {
    try { await Linking.openURL(url); } catch { Alert.alert('Contact', fallback); }
  };

  /** WhatsApp app first, then the web link; the number as a last resort. */
  const openWhatsApp = async (num: string) => {
    const n = digits(num).replace(/^\+/, '');
    const withCountry = n.length === 10 ? `91${n}` : n;
    try {
      const app = `whatsapp://send?phone=${withCountry}`;
      const can = await Linking.canOpenURL(app).catch(() => false);
      await Linking.openURL(can ? app : `https://wa.me/${withCountry}`);
    } catch {
      Alert.alert('WhatsApp', num);
    }
  };

  const header = (
    <PremiumPageHeader
      eyebrow="We are here to help"
      title="Help & Support"
      subtitle={appRef ? `Your messages carry your application reference ${appRef}.` : 'Your message goes straight to the office team.'}
      onBack={() => navigation.goBack()}
      art={<SupportHeadset3D size={88} />}
    />
  );

  return (
    <PremiumPage header={header}>
      <View style={styles.overlap}>
        {phone || email ? (
          <FadeInUp delay={80} distance={12} style={styles.quickRow}>
            {phone ? <QuickTile icon="call" tone="blue" label="Call" detail={phone} onPress={() => openUrl(`tel:${digits(phone)}`, phone)} /> : null}
            {phone ? <QuickTile icon="chat" colors={['#128C7E', '#25D366']} label="WhatsApp" detail="Message us" onPress={() => openWhatsApp(phone)} /> : null}
            {email ? <QuickTile icon="mail-outline" tone="amber" label="Email" detail={email} onPress={() => openUrl(`mailto:${email}`, email)} /> : null}
          </FadeInUp>
        ) : null}

        {hasDetails ? (
          <FadeInUp delay={140} distance={12}>
            <GroupTitle title="Contact the association" style={!(phone || email) ? styles.firstGroup : undefined} />
            <SurfaceCard padded={false} style={styles.gutter} contentStyle={styles.cardPadH}>
              {hours.length ? <DetailRow icon="schedule" tone="sky" label="Working hours" lines={hours} last={!email && !phone && !altPhone && !address.length} /> : null}
              {email ? <DetailRow icon="mail-outline" tone="amber" label="Email" lines={[email]} onPress={() => openUrl(`mailto:${email}`, email)} last={!phone && !altPhone && !address.length} /> : null}
              {phone ? <DetailRow icon="call" tone="blue" label="Phone" lines={[phone]} actionIcon="phone-in-talk" onPress={() => openUrl(`tel:${digits(phone)}`, phone)} last={!altPhone && !address.length} /> : null}
              {altPhone ? <DetailRow icon="call" tone="teal" label="Alternate phone" lines={[altPhone]} actionIcon="phone-in-talk" onPress={() => openUrl(`tel:${digits(altPhone)}`, altPhone)} last={!address.length} /> : null}
              {address.length ? (
                <DetailRow
                  icon="place"
                  tone="rose"
                  label={mapLink ? 'Office · tap for directions' : 'Office'}
                  lines={address}
                  actionIcon="directions"
                  onPress={mapLink ? () => openUrl(mapLink, address.join(', ')) : undefined}
                  last
                />
              ) : null}
            </SurfaceCard>
          </FadeInUp>
        ) : null}

        <FadeInUp delay={200} distance={12}>
          <GroupTitle title="Common questions" count={FAQ.length} style={!hasDetails && !(phone || email) ? styles.firstGroup : undefined} />
          <SurfaceCard padded={false} style={styles.gutter}>
            {FAQ.map((item, i) => (
              <Faq key={item.question} item={item} last={i === FAQ.length - 1} open={open === item.question} onToggle={() => setOpen(open === item.question ? '' : item.question)} />
            ))}
          </SurfaceCard>
        </FadeInUp>

        <FadeInUp delay={260} distance={12} style={styles.formWrap}>
          <PremiumSection icon="forum" title="Send us a message" subtitle="The team replies to the email you give here.">
            <PremiumInput label="Your name" required value={form.name} onChangeText={set('name')} placeholder="Full name" icon="person-outline" autoCapitalize="words" editable={!sending} />
            <PremiumInput label="Email" required value={form.email} onChangeText={set('email')} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} icon="mail-outline" editable={!sending} />
            <PremiumInput label="Phone" value={form.phone} onChangeText={set('phone')} placeholder="Optional" keyboardType="phone-pad" icon="call" editable={!sending} />
            <PremiumInput label="Subject" value={form.subject} onChangeText={set('subject')} placeholder="What is this about?" icon="subject" editable={!sending} />
            <PremiumInput
              label="Message"
              required
              value={form.message}
              onChangeText={set('message')}
              placeholder="Tell us what you need help with"
              multiline
              numberOfLines={5}
              editable={!sending}
              hint={appRef ? `Sent with application ${appRef}` : undefined}
            />
            {formError ? <Notice kind="danger" text={formError} style={styles.inlineNotice} /> : null}
            {sent ? <Notice kind="success" text={sent} style={styles.inlineNotice} /> : null}
            <GradientButton label={sending ? 'Sending…' : 'Send message'} icon="send" onPress={submit} loading={sending} />
          </PremiumSection>
        </FadeInUp>
      </View>
    </PremiumPage>
  );
};

const styles = StyleSheet.create({
  flexMin: { flex: 1, minWidth: 0 },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  firstGroup: { marginTop: SPACE.sm },
  gutter: { marginHorizontal: SPACE.lg },
  cardPadH: { paddingHorizontal: SPACE.lg },
  quickRow: { flexDirection: 'row', gap: SPACE.sm, marginHorizontal: SPACE.lg },
  quickWrap: {
    flex: 1, minWidth: 0, borderRadius: 20, backgroundColor: PALETTE.white,
    shadowColor: BRAND.shadowNavy, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 18, elevation: 5,
  },
  quick: { alignItems: 'center', paddingVertical: SPACE.lg, paddingHorizontal: SPACE.sm, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(226,232,240,0.9)', backgroundColor: PALETTE.white },
  quickLabel: { ...TYPE.bodyStrong, marginTop: SPACE.sm },
  quickDetail: { ...TYPE.caption, fontSize: 11, marginTop: 1, maxWidth: '100%' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md, minHeight: SIZE.row },
  divider: { borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  detailLabel: { ...TYPE.caption },
  detailValue: { ...TYPE.bodyStrong, marginTop: SPACE.xxs },
  faq: { paddingHorizontal: SPACE.lg },
  faqOpen: { backgroundColor: PALETTE.blueTint },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.md, minHeight: SIZE.row },
  faqQ: { ...TYPE.bodyStrong, flex: 1, minWidth: 0 },
  chev: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.field },
  chevOpen: { backgroundColor: PALETTE.blue },
  faqA: { ...TYPE.body, lineHeight: 21, paddingBottom: SPACE.lg, paddingLeft: 40 + SPACE.md },
  formWrap: { marginTop: SPACE.xl },
  inlineNotice: { marginHorizontal: 0, marginTop: 0, marginBottom: SPACE.md },
});

export default MemberHelpScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_BRAND = BRAND;
