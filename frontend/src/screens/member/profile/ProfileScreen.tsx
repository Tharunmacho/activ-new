import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  Notice, PALETTE, SPACE, SHADOW, TYPE, errorText, BRAND,
  PremiumPage, PremiumPageHeader, PREMIUM_OVERLAP, GradientButton, GradientAvatar, GlassIconButton, FadeInUp,
  SurfaceCard, GradientGlyph, GlyphTone, LinkRow, MeterBar, GLYPH_COLORS, CardSkeletons, NewMemberCard3D,
} from '../../../ui';
import {
  getMyProfile, getBusinessInfo, getFinancialInfo, getDeclarationInfo, getMyApplications,
  uploadProfilePhoto, isPaidMember, logoutOnServer,
} from '../../../services/memberApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { clearSession } from '../../../services/session';
import { useAuthStore } from '../../../stores/exampleStore';
import { useMemberStore } from '../../../stores/memberStore';

/**
 * ============================================================================
 * MY PROFILE — website `features/member/pages/ProfileView.tsx`
 * ============================================================================
 *
 *   GET /members/my-profile · /members/business-info · /members/financial-info
 *       /members/declaration-info · /applications/my-applications
 *   POST /members/profile-photo   multipart `profilePhoto` (≤ 5 MB, image only)
 *
 * One screen for both the unpaid (the Profile tab) and the paid member
 * (`PaidProfile`), as the website has one /member/profile-view:
 *
 *   header      photo (tap the camera to change), name, email, phone, pills
 *               for district / state / Member ID
 *   progress    "Application forms — N of 3 submitted", a pill per form, the
 *               Submit Application call when all three are saved but no
 *               application exists yet
 *   sections    Personal · Business (aspirant/student variant) · Financial &
 *               Compliance (never for an aspirant; edited in the Business
 *               Account) · Declaration (sister concerns only for a business).
 *               Empty fields are omitted, not printed as "N/A". When NOTHING is
 *               filled, each missing section shows a "Complete now" card.
 */

const titleCase = (value: unknown): string => {
  const text = String(value ?? '').trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

const yesNo = (value: unknown): string => {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  if (value === undefined || value === null || value === '') return '';
  return String(value);
};

const asText = (value: unknown): string => {
  if (Array.isArray(value)) return value.filter(Boolean).map((v) => String(v)).join(', ');
  if (value === undefined || value === null || value === '') return '';
  return String(value);
};

function Item({ label, value }: { label: string; value?: string | number | null }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const text = value === undefined || value === null ? '' : String(value).trim();
  if (!text) return null;
  return (
    <View style={s.item}>
      <Text style={s.itemLabel} maxFontSizeMultiplier={1.3}>{label}</Text>
      <Text style={s.itemValue} selectable maxFontSizeMultiplier={1.3}>{text}</Text>
    </View>
  );
}

function Section({ icon, tone = 'blue', title, onEdit, editLabel = 'Edit', children, delay = 0 }: {
  icon: string; tone?: GlyphTone; title: string; onEdit?: () => void; editLabel?: string; children: React.ReactNode; delay?: number;
}) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <FadeInUp delay={delay}>
      <SurfaceCard style={s.section}>
        <View style={s.sectionHead}>
          <GradientGlyph icon={icon} tone={tone} size={42} />
          <Text style={s.sectionTitle} numberOfLines={2} accessibilityRole="header">{title}</Text>
          {onEdit ? (
            <TouchableOpacity onPress={onEdit} style={s.editBtn} hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }} accessibilityRole="button" accessibilityLabel={`${editLabel} ${title}`}>
              <Icon name="edit" size={15} color={PALETTE.primary} />
              <Text style={s.editText} maxFontSizeMultiplier={1.3}>{editLabel}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={s.sectionBody}>{children}</View>
      </SurfaceCard>
    </FadeInUp>
  );
}

function NotYet({ icon, tone = 'slate', title, detail, onGo }: { icon: string; tone?: GlyphTone; title: string; detail: string; onGo: () => void }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const TYPE = useLegacyAppearance(legacyAppearance_TYPE);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={s.notYet}>
      <View style={s.notYetRow}>
        <GradientGlyph icon={icon} tone={tone} size={42} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.sectionTitle}>{title}</Text>
          <Text style={[TYPE.body, { color: PALETTE.textMuted, marginTop: SPACE.xs }]}>{detail}</Text>
        </View>
      </View>
      <GradientButton label="Complete now" iconRight="arrow-forward" variant="outline" onPress={onGo} style={{ marginTop: SPACE.lg }} />
    </View>
  );
}

const ProfileScreen: React.FC<any> = ({ navigation }) => {
  const s = useLegacyAppearance(legacyAppearance_s);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const BRAND = useLegacyAppearance(legacyAppearance_BRAND);
  const TYPE = useLegacyAppearance(legacyAppearance_TYPE);
  const { logout } = useAuthStore();
  const { updateMember } = useMemberStore();
  const [loading, setLoading] = useState(true);
  const [personal, setPersonal] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [financial, setFinancial] = useState<any>(null);
  const [declaration, setDeclaration] = useState<any>(null);
  const [application, setApplication] = useState<any>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ kind: 'success' | 'danger'; text: string } | null>(null);
  const [viewing, setViewing] = useState(false);
  const [photoBroken, setPhotoBroken] = useState(false);

  const load = useCallback(async () => {
    const [p, b, f, d, a] = await Promise.allSettled([
      getMyProfile(), getBusinessInfo(), getFinancialInfo(), getDeclarationInfo(), getMyApplications(),
    ]);
    const me = p.status === 'fulfilled' && p.value && Object.keys(p.value || {}).length ? p.value : null;
    setPersonal(me);
    if (me) { try { updateMember(me); } catch { /* store is a cache only */ } }
    setBusiness(b.status === 'fulfilled' ? b.value : null);
    setFinancial(f.status === 'fulfilled' ? f.value : null);
    setDeclaration(d.status === 'fulfilled' ? d.value : null);
    const apps = a.status === 'fulfilled' ? (a.value || []) : [];
    setApplication(apps.length ? apps[0] : null);
    setLoading(false);
  }, [updateMember]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const hasBusiness = useMemo(() => {
    if (!business) return false;
    return business.doingBusiness === true || business.doingBusiness === false
      || !!String(business.organizationName || '').trim();
  }, [business]);

  const hasFinancial = useMemo(() => {
    if (!financial) return false;
    const filled = ['panNumber', 'gstNumber', 'udyamNumber', 'turnoverRange']
      .some((key) => !!String(financial?.[key] || '').trim());
    return filled || financial.filedITR === true || financial.govtSchemeBenefit === true
      || (!!financial.status && financial.status !== 'draft');
  }, [financial]);

  const hasDeclaration = useMemo(() => {
    if (!declaration) return false;
    return declaration.agreeToDeclaration === true
      || Number(declaration.sisterConcerns || 0) > 0
      || (Array.isArray(declaration.companyNames) ? declaration.companyNames : []).length > 0;
  }, [declaration]);

  const paid = isPaidMember(personal);
  const isAspirant = business?.doingBusiness === false;
  const regType = String(business?.registrationType || '').toLowerCase();
  const nothingFilled = !personal && !hasBusiness && !hasFinancial && !hasDeclaration;

  /* The website's /member/profile?step=N editor. A paid member edits in the
     Edit* screens; an applicant in the application forms. */
  const goPersonal = () => navigation.navigate(paid ? 'EditProfile' : 'PersonalDetailsForm', paid ? undefined : {});
  const goBusiness = () => navigation.navigate(paid ? 'EditBusiness' : 'BusinessInformationForm', paid ? undefined : {});
  const goDeclaration = () => navigation.navigate(paid ? 'EditDeclaration' : 'DeclarationForm', paid ? undefined : {});
  /* Financial details live on the company in the Business Account (website
     /business/companies). */
  const goFinancial = () => navigation.navigate('ManageCompanies');

  const sections = [
    { filled: !!personal, label: 'Personal Details', go: goPersonal },
    { filled: hasBusiness, label: 'Business Details', go: goBusiness },
    { filled: hasDeclaration, label: 'Declaration', go: goDeclaration },
  ];
  const doneCount = sections.filter((x) => x.filled).length;
  const readyToSubmit = !application && doneCount === sections.length;

  const name = String(personal?.fullName || personal?.name || 'Member');
  const photo = resolveMediaUrl(personal?.profilePhoto || personal?.profileImage || '');
  const showPhoto = !!photo && !photoBroken;

  const pickPhoto = () => {
    setPhotoMsg(null);
    try {
      if (typeof launchImageLibrary !== 'function') {
        setPhotoMsg({ kind: 'danger', text: 'The photo picker is not available on this device.' });
        return;
      }
      launchImageLibrary({ mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200, selectionLimit: 1 }, async (res: any) => {
        try {
          if (res?.didCancel) return;
          if (res?.errorCode) {
            setPhotoMsg({ kind: 'danger', text: res?.errorMessage || 'Could not open your photos.' });
            return;
          }
          const asset = (res?.assets || [])[0];
          if (!asset?.uri) return;
          if (asset?.type && !String(asset.type).startsWith('image/')) {
            setPhotoMsg({ kind: 'danger', text: 'Please choose an image file (JPG, PNG or WebP).' });
            return;
          }
          if (Number(asset?.fileSize || 0) > 5 * 1024 * 1024) {
            setPhotoMsg({ kind: 'danger', text: 'The photo must be under 5 MB.' });
            return;
          }
          setPhotoBusy(true);
          const stored = await uploadProfilePhoto(asset.uri, asset?.type || 'image/jpeg', asset?.fileName || 'profile.jpg');
          setPersonal((prev: any) => ({ ...(prev || {}), profilePhoto: stored }));
          setPhotoBroken(false);
          try { updateMember({ profilePhoto: stored }); } catch { /* cache only */ }
          setPhotoMsg({ kind: 'success', text: 'Profile photo updated' });
        } catch (err) {
          setPhotoMsg({ kind: 'danger', text: errorText(err, 'Failed to upload photo') });
        } finally {
          setPhotoBusy(false);
        }
      });
    } catch (err) {
      console.warn('Native module call safely caught:', err);
    }
  };

  const signOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive', onPress: async () => {
          await logoutOnServer();
          await clearSession();
          try { await logout(); } catch { /* storage already cleared */ }
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const pills = [
    personal?.district ? { text: String(personal.district), icon: 'place' } : null,
    personal?.state ? { text: String(personal.state), icon: 'map' } : null,
    personal?.membershipNumber ? { text: `ID ${personal.membershipNumber}`, icon: 'badge' } : null,
  ].filter(Boolean) as { text: string; icon: string }[];
  const percent = Math.round((doneCount / Math.max(1, sections.length)) * 100);

  const header = (
    <PremiumPageHeader
      eyebrow={paid ? 'Active member' : 'Your application'}
      title="My profile"
      subtitle="Everything you have submitted, in one place."
      onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
      right={<GlassIconButton icon="settings" onPress={() => navigation.navigate('AccountSettings')} accessibilityLabel="Settings" />}
      art={<NewMemberCard3D size={80} />}
      artSize={80}
    >
      {!loading ? (
        <View>
          <View style={s.heroRow}>
            <View>
              <TouchableOpacity
                onPress={() => (showPhoto ? setViewing((v) => !v) : pickPhoto())}
                accessibilityLabel={showPhoto ? 'View your profile photo' : 'Add a profile photo'}
                activeOpacity={0.85}
              >
                <GradientAvatar name={name} uri={showPhoto ? photo : undefined} size={80} status={paid ? 'verified' : undefined} />
              </TouchableOpacity>
              <TouchableOpacity onPress={pickPhoto} disabled={photoBusy} style={s.camera} accessibilityLabel="Change profile photo" accessibilityRole="button">
                {photoBusy ? <ActivityIndicator size="small" color={PALETTE.primary} /> : <Icon name="photo-camera" size={16} color={PALETTE.primary} />}
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.heroName} numberOfLines={2} maxFontSizeMultiplier={1.25}>{name}</Text>
              {personal?.email ? (
                <View style={s.heroLine}><Icon name="mail-outline" size={14} color={BRAND.onBrandFaint} /><Text style={s.heroSub} numberOfLines={1}>{String(personal.email)}</Text></View>
              ) : null}
              {personal?.phoneNumber ? (
                <View style={s.heroLine}><Icon name="call" size={14} color={BRAND.onBrandFaint} /><Text style={s.heroSub} numberOfLines={1}>{String(personal.phoneNumber)}</Text></View>
              ) : null}
            </View>
          </View>
          {pills.length ? (
            <View style={s.pills}>
              {pills.map((p) => (
                <View key={p.text} style={s.pill}>
                  <Icon name={p.icon} size={13} color={PALETTE.white} />
                  <Text style={s.pillText} numberOfLines={1}>{p.text}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </PremiumPageHeader>
  );

  if (loading) {
    return (
      <PremiumPage header={header}>
        <CardSkeletons rows={4} style={s.overlap} />
      </PremiumPage>
    );
  }

  return (
    <PremiumPage header={header} onRefresh={load} refreshing={false}>
      {viewing && showPhoto ? (
        <FadeInUp style={s.overlap}>
          <SurfaceCard style={s.gutter}>
            <Image source={{ uri: photo }} style={s.viewerImg} resizeMode="contain" onError={() => setPhotoBroken(true)} />
            <View style={{ flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.md }}>
              <GradientButton label="Change" icon="image" onPress={pickPhoto} loading={photoBusy} style={{ flex: 1 }} />
              <GradientButton label="Close" variant="outline" onPress={() => setViewing(false)} style={{ flex: 1 }} />
            </View>
          </SurfaceCard>
        </FadeInUp>
      ) : null}
      {photoMsg ? <Notice kind={photoMsg.kind} text={photoMsg.text} style={[s.gutter, viewing && showPhoto ? { marginTop: SPACE.md } : s.overlap, { marginBottom: SPACE.md }]} /> : null}

      {/* ------------------------------------------------ application forms */}
      <FadeInUp delay={200} style={(viewing && showPhoto) || photoMsg ? { marginTop: SPACE.md } : s.overlap}>
        <SurfaceCard style={s.gutter}>
          <View style={s.progressHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.sectionTitle}>Application forms</Text>
              <Text style={s.count} maxFontSizeMultiplier={1.3}>{doneCount} of {sections.length} submitted</Text>
            </View>
            <View style={[s.pctBadge, doneCount === sections.length && { backgroundColor: PALETTE.successSoft }]}>
              <Text style={[s.pctText, doneCount === sections.length && { color: PALETTE.successText }]}>{percent}%</Text>
            </View>
          </View>
          <MeterBar value={Math.max(percent / 100, 0.03)} colors={doneCount === sections.length ? GLYPH_COLORS.green : GLYPH_COLORS.blue} style={{ marginBottom: SPACE.lg }} />
          {readyToSubmit ? (
            <Text style={[TYPE.body, { marginBottom: SPACE.md }]}>
              Your forms are saved. Submit them to start the review — nothing reaches the admins until you do.
            </Text>
          ) : null}
          <View style={s.formPills}>
            {sections.map((sec) => (sec.filled ? (
              <View key={sec.label} style={[s.formPill, { backgroundColor: PALETTE.successSoft }]}>
                <Icon name="check-circle" size={16} color={PALETTE.successText} />
                <Text style={[s.formPillText, { color: PALETTE.successText }]} numberOfLines={1}>{sec.label}</Text>
              </View>
            ) : (
              <TouchableOpacity key={sec.label} onPress={sec.go} style={[s.formPill, { backgroundColor: PALETTE.primarySoft }]} accessibilityRole="button">
                <Icon name="radio-button-unchecked" size={16} color={PALETTE.primaryDark} />
                <Text style={[s.formPillText, { color: PALETTE.primaryDark }]} numberOfLines={1}>{sec.label}</Text>
                <Icon name="arrow-forward" size={16} color={PALETTE.primaryDark} />
              </TouchableOpacity>
            )))}
          </View>
          {readyToSubmit ? (
            <GradientButton label="Submit Application" iconRight="arrow-forward" onPress={goDeclaration} style={{ marginTop: SPACE.lg }} />
          ) : null}
        </SurfaceCard>
      </FadeInUp>

      {/* ------------------------------------------------ personal */}
      {personal ? (
        <Section icon="person-outline" tone="blue" title="Personal Information" onEdit={goPersonal} delay={260}>
          <Item label="Full Name" value={personal.fullName || personal.name} />
          <Item label="Email" value={personal.email} />
          <Item label="Phone Number" value={personal.phoneNumber} />
          <Item label="Membership Status" value={titleCase(personal.membershipStatus) || 'Pending'} />
          <Item label="Membership Type" value={titleCase(personal.memberType) || titleCase(personal.registrationType) || titleCase(personal.membershipType)} />
          <Item label="Member ID" value={personal.membershipNumber} />
          <Item label="State" value={personal.state} />
          <Item label="District" value={personal.district} />
          <Item label="Block" value={personal.block} />
          <Item label="City" value={personal.city} />
          <Item label="Social Category" value={personal.socialCategory} />
          <Item label="Religion" value={personal.religion} />
          <Item label="Gender" value={personal.gender} />
        </Section>
      ) : null}

      {/* ------------------------------------------------ business */}
      {hasBusiness ? (
        <Section icon="work-outline" tone="teal" title="Business Information" onEdit={goBusiness} delay={300}>
          {isAspirant ? (
            <>
              <Item label="Business Status" value={regType === 'student' ? 'Student (not currently doing business)' : 'Aspirant (not currently doing business)'} />
              <Item label="Registration Type" value={business?.registrationType} />
            </>
          ) : (
            <>
              <Item label="Business Status" value={yesNo(business?.doingBusiness)} />
              <Item label="Registration Type" value={business?.registrationType} />
              <Item label="Organization Name" value={business?.organizationName} />
              <Item label="Constitution Type" value={business?.constitutionType} />
              <Item label="Commencement Year" value={business?.businessCommencementYear} />
              <Item label="Number of Employees" value={business?.numberOfEmployees} />
              <Item label="Business Activities" value={asText(business?.businessActivities)} />
              <Item label="Business Types" value={asText(business?.businessTypes)} />
              <Item label="Govt Organizations" value={asText(business?.govtOrganizations)} />
              <Item label="Other Chamber Member?" value={yesNo(business?.memberOfOtherChamber)} />
              <Item label="Other Chamber Name" value={business?.otherChamber} />
            </>
          )}
        </Section>
      ) : nothingFilled ? (
        <NotYet icon="work-outline" title="Business Information" detail="Tell us whether you run a business, and its details, to complete this section." onGo={goBusiness} />
      ) : null}

      {/* ------------------------------------------------ financial (never for an aspirant) */}
      {isAspirant ? null : hasFinancial ? (
        <Section icon="account-balance" tone="green" title="Financial & Compliance" onEdit={goFinancial} delay={340}>
          <Item label="PAN Number" value={financial?.panNumber} />
          <Item label="GST Number" value={financial?.gstNumber} />
          <Item label="UDYAM Number" value={financial?.udyamNumber} />
          <Item label="Filed ITR?" value={yesNo(financial?.filedITR)} />
          <Item label="Turnover Range" value={financial?.turnoverRange} />
          <Item label="Govt Scheme Benefit?" value={yesNo(financial?.govtSchemeBenefit)} />
          <Item label="Government Schemes" value={asText(financial?.govtSchemes)} />
          <Item label="Scheme Details" value={financial?.schemeDetails} />
        </Section>
      ) : nothingFilled ? (
        <NotYet icon="account-balance" title="Financial & Compliance" detail="PAN, GSTIN, turnover and government registrations are asked in your Business Account, on the company they belong to." onGo={goFinancial} />
      ) : null}

      {/* ------------------------------------------------ declaration */}
      {hasDeclaration ? (
        <Section icon="fact-check" tone="amber" title="Declaration" onEdit={goDeclaration} delay={380}>
          {isAspirant || regType === 'aspirant' || regType === 'student' ? null : (
            <>
              <Item label="Number of Sister Concerns" value={declaration?.sisterConcerns} />
              <Item label="Company Names" value={asText(declaration?.companyNames)} />
            </>
          )}
          <Item label="Declaration Agreed?" value={yesNo(declaration?.agreeToDeclaration)} />
        </Section>
      ) : nothingFilled ? (
        <NotYet icon="fact-check" title="Declaration" detail="Declare any sister concerns and accept the association's declaration." onGo={goDeclaration} />
      ) : null}

      <FadeInUp delay={420}>
        <SurfaceCard style={[s.gutter, { marginTop: SPACE.xl }]} padded={false}>
          <LinkRow icon="settings" tone="navy" title="Settings" subtitle="Password, photo and sign-in" onPress={() => navigation.navigate('AccountSettings')} />
          <LinkRow icon="logout" title="Sign out" danger onPress={signOut} last />
        </SurfaceCard>
      </FadeInUp>
    </PremiumPage>
  );
};

const s = StyleSheet.create({
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  camera: { position: 'absolute', right: -4, bottom: -4, width: 32, height: 32, borderRadius: 16, backgroundColor: PALETTE.white, alignItems: 'center', justifyContent: 'center', ...SHADOW.card },
  heroName: { ...TYPE.title, fontSize: 21, lineHeight: 27, color: PALETTE.white },
  heroLine: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 2, marginTop: SPACE.xs },
  heroSub: { ...TYPE.caption, fontSize: 13, lineHeight: 18, color: BRAND.onBrandSoft, flexShrink: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.lg, marginBottom: SPACE.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, borderRadius: 999, paddingHorizontal: SPACE.md - 2, minHeight: 28, maxWidth: '100%', backgroundColor: BRAND.glass, borderWidth: 1, borderColor: BRAND.glassBorder },
  pillText: { ...TYPE.caption, fontWeight: '700', color: PALETTE.white, flexShrink: 1 },
  viewerImg: { width: '100%', height: 280, borderRadius: 16, backgroundColor: PALETTE.field },
  section: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.md },
  sectionTitle: { ...TYPE.heading, flex: 1, minWidth: 0 },
  sectionBody: { marginBottom: -SPACE.sm },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, paddingHorizontal: SPACE.md, minHeight: 36, borderRadius: 999, backgroundColor: PALETTE.primarySoft },
  editText: { ...TYPE.label, fontWeight: '700', color: PALETTE.primary },
  item: { paddingVertical: SPACE.md - 2, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  itemLabel: { ...TYPE.caption, fontWeight: '600', letterSpacing: 0.3 },
  itemValue: { ...TYPE.subheading, fontSize: 15, lineHeight: 21, marginTop: SPACE.xxs },
  progressHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md, gap: SPACE.sm },
  count: { ...TYPE.caption, fontWeight: '700', marginTop: 2 },
  pctBadge: { minWidth: 54, height: 34, borderRadius: 17, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.primarySoft },
  pctText: { fontSize: 14, fontWeight: '800', color: PALETTE.primaryDark, fontVariant: ['tabular-nums'] },
  formPills: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  formPill: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 2, borderRadius: 999, paddingHorizontal: SPACE.md, minHeight: 36, maxWidth: '100%' },
  formPillText: { ...TYPE.label, fontWeight: '700', flexShrink: 1 },
  notYet: { marginHorizontal: SPACE.lg, marginTop: SPACE.lg, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: PALETTE.borderStrong, padding: SPACE.lg, backgroundColor: PALETTE.card },
  notYetRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
});

export default ProfileScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_TYPE = TYPE;
const legacyAppearance_BRAND = BRAND;
