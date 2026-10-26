import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import StudentNetworkingGate from '../StudentNetworkingGate';
import { isStudentMembership } from '../../../utils/memberAudience';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Notice, TYPE, SIZE, PALETTE, SPACE, asArray, money, errorText,
  PremiumPage, PremiumPageHeader, HeaderStat, HeaderStatRow, PREMIUM_OVERLAP, GlassIconButton, GlassBadge,
  SurfaceCard, GradientGlyph, GroupTitle, StateView, CardSkeletons, GradientAvatar, GradientButton, FadeInUp,
  PressableScale, EmptyBox3D, FitImage } from '../../../ui';
import { getDirectoryEntry, openConversationWith, recordProductView } from '../../../services/memberApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { useLoad } from '../useLoad';
import { useMemberAccess, useLockedCta, runMembershipCta } from '../useMemberAccess';
import { longDate } from '../events/eventFormat';
import { MEMBERS_ONLY_COPY } from '../messages/messageCopy';
import { PhotoViewer } from '../../../ui/PhotoViewer';
import CatalogueAlbum from '../../../components/CatalogueAlbum';

/**
 * One member's directory card — website `DirectoryProfile.tsx`.
 *
 * GET /members/directory/:id — photo, name, Region, Member since, sectors,
 * Businesses (logo, name, type — never an address), the Catalogue ("N listed",
 * name · category · price) and "Message <first name>":
 * POST /messages/with/:memberId → the thread. Your OWN card says "This is how
 * other members see your profile" instead; an unpaid viewer is told messaging
 * needs an active membership and given their next step. A product the member
 * taps is recorded (POST /products/:id/view) — the website's hover, once per visit.
 *
 * No phone or email: the directory is an allow-list (directory.service.js),
 * and Message is its contact action.
 */
const MESSAGING_DOWN = /route .* not found|network error|404|50\d|ECONNREFUSED/i;

const yearOf = (v?: string | null) => {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : String(d.getFullYear());
};

function Fact({ icon, label, value, tone }: { icon: string; label: string; value: string; tone?: 'blue' | 'teal' }) {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  return (
    <View style={styles.fact}>
      <GradientGlyph icon={icon} tone={tone || 'blue'} size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.factLabel} maxFontSizeMultiplier={1.25}>{label}</Text>
        <Text style={styles.factValue} maxFontSizeMultiplier={1.25}>{value}</Text>
      </View>
    </View>
  );
}

const DirectoryProfileScreen = ({ navigation, route }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const id = String(route?.params?.id || '');
  const { data: m, loading, error, reload, refreshing, refresh } = useLoad<any>(() => getDirectoryEntry(id), [id], null);
  const { paid, profile } = useMemberAccess();
  const cta = useLockedCta(paid, profile);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState('');
  const [askedToConnect, setAskedToConnect] = useState(false);
  const [seen] = useState(() => new Set<string>());
  const [photoOpen, setPhotoOpen] = useState(false);
  const [albumAt, setAlbumAt] = useState<number | null>(null);
  useEffect(() => { setPhotoOpen(false); }, [id, m?.profilePhoto]);
  useEffect(() => { setAlbumAt(null); }, [id]);

  const isSelf = !!id && [profile?.memberId, profile?._id, profile?.id, profile?.userId]
    .filter(Boolean).map(String).includes(id);

  const message = async () => {
    if (!id || opening || isSelf) return;
    setOpening(true);
    setOpenError('');
    try {
      const conv = await openConversationWith(id);
      const conversationId = String(conv?.id || conv?.conversation?.id || '');
      if (conversationId) navigation.navigate('MessageThread', { conversationId, name: m?.fullName || route?.params?.name });
      else navigation.navigate('MemberMessages');
    } catch (err) {
      const raw = errorText(err, '');
      setOpenError(!raw || MESSAGING_DOWN.test(raw) ? 'Messaging is unavailable at the moment. Please try again in a few minutes.' : raw);
    } finally {
      setOpening(false);
    }
  };

  const viewProduct = (pid: string) => {
    if (!pid || seen.has(pid)) return;
    seen.add(pid);
    recordProductView(pid);
  };

  const allMembers = (
    <GlassIconButton icon="groups" onPress={() => navigation.navigate('MemberDirectory')} accessibilityLabel="All members" />
  );
  const fallbackName = String(route?.params?.name || 'Member');

  if (isStudentMembership(profile)) return <StudentNetworkingGate navigation={navigation} />;

  if (loading) {
    return (
      <PremiumPage safeBottom
        header={<PremiumPageHeader eyebrow="ACTIV member" title={fallbackName} subtitle="Opening their card…" onBack={() => navigation.goBack()} right={allMembers} />}
      >
        <View style={styles.overlap}><CardSkeletons rows={3} variant="media" /></View>
      </PremiumPage>
    );
  }
  if (error || !m) {
    return (
      <PremiumPage safeBottom
        header={<PremiumPageHeader eyebrow="ACTIV Network" title={fallbackName} onBack={() => navigation.goBack()} right={allMembers} />}
      >
        <StateView
          kind={error ? 'error' : 'empty'}
          title="This member is not listed"
          message={error || 'Only members with an active membership appear in ACTIV Network.'}
          action={error ? 'Try again' : 'Back to ACTIV Network'}
          actionIcon={error ? 'refresh' : 'groups'}
          onAction={() => (error ? reload() : navigation.navigate('MemberDirectory'))}
        />
      </PremiumPage>
    );
  }

  const photo = resolveMediaUrl(m?.profilePhoto || '');
  const where = [m?.block, m?.district, m?.state].filter(Boolean).join(', ');
  const companies = asArray<any>(m?.companies);
  const products = asArray<any>(m?.products);
  const sectors = asArray<string>(m?.sectors).filter(Boolean);
  const listed = Number(m?.productCount || products.length);
  const firstName = String(m?.fullName || '').split(' ').filter(Boolean)[0] || 'member';
  const since = yearOf(m?.memberSince);

  return (
    <><PremiumPage safeBottom
      refreshing={refreshing}
      onRefresh={refresh}
      header={(
        <PremiumPageHeader
          eyebrow="ACTIV member"
          title={m?.fullName || 'Member'}
          subtitle={companies[0]?.businessName || undefined}
          onBack={() => navigation.goBack()}
          right={allMembers}
          art={<GradientAvatar name={m?.fullName || 'Member'} uri={photo || undefined} size={92} status="verified" />}
          artSize={96}
          artLabel={photo ? `View ${m?.fullName || 'member'}'s profile photo` : `${m?.fullName || 'Member'}'s initials`}
          onArtPress={photo ? () => setPhotoOpen(true) : undefined}
        >
          <View style={{ gap: SPACE.md }}>
            {sectors.length ? (
              <View style={styles.sectors}>
                {sectors.map((s) => <GlassBadge key={s} label={s} icon="sell" />)}
              </View>
            ) : null}
            <HeaderStatRow>
              <HeaderStat icon="event" value={since || '—'} label="Member since" />
              <HeaderStat icon="storefront" value={companies.length} label={companies.length === 1 ? 'Business' : 'Businesses'} />
              <HeaderStat icon="inventory-2" value={listed} label="Listed" />
            </HeaderStatRow>
          </View>
        </PremiumPageHeader>
      )}
    >
      {/* ---------------- identity + the contact action */}
      <FadeInUp delay={200} style={styles.overlap}>
        <SurfaceCard style={styles.block}>
          {where ? <Fact icon="place" label="Region" value={where} /> : null}
          {m?.memberSince ? <Fact icon="verified" tone="teal" label="Member since" value={longDate(m.memberSince)} /> : null}
          <View style={where || m?.memberSince ? styles.actionGap : undefined}>
            {isSelf ? (
              <View style={styles.self}>
                <Icon name="visibility" size={SIZE.iconSm} color={PALETTE.blueDark} />
                <Text style={styles.selfText}>This is how other members see your profile.</Text>
              </View>
            ) : (
              <GradientButton
                label={`Message ${firstName}`}
                icon={paid ? 'chat' : 'lock'}
                loading={opening}
                onPress={() => (paid ? message() : setAskedToConnect(true))}
              />
            )}
            {openError ? <Notice kind="warning" text={openError} style={styles.inlineNotice} /> : null}
            {askedToConnect && !paid ? (
              <Notice
                kind="info"
                icon="lock-outline"
                title={MEMBERS_ONLY_COPY.title}
                text={`${MEMBERS_ONLY_COPY.short} ${cta.detail || ''}`.trim()}
                action={`${cta.label} →`}
                onAction={() => runMembershipCta(navigation, cta.target, profile)}
                style={styles.inlineNotice}
              />
            ) : null}
          </View>
        </SurfaceCard>
      </FadeInUp>

      {/* ---------------- businesses */}
      {companies.length ? (
        <FadeInUp delay={260}>
          <GroupTitle title={companies.length === 1 ? 'Business' : 'Businesses'} count={companies.length} style={styles.groupTight} />
          <SurfaceCard style={styles.block} padded={false}>
            {companies.map((c, i) => {
              const logo = resolveMediaUrl(c?.logo || '');
              return (
                <View key={String(c?.id || c?.businessName || i)} style={[styles.company, i < companies.length - 1 && styles.companyDivider]}>
                  {logo ? <Image source={{ uri: logo }} style={styles.logo} /> : <GradientGlyph icon="storefront" size={46} />}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{c?.businessName || 'Company'}</Text>
                    {c?.businessType ? <Text style={styles.sub} numberOfLines={1}>{c.businessType}</Text> : null}
                  </View>
                </View>
              );
            })}
          </SurfaceCard>
        </FadeInUp>
      ) : null}

      {/* ---------------- catalogue */}
      <FadeInUp delay={320}>
        <GroupTitle title="Catalogue" count={products.length ? listed : undefined} subtitle={products.length ? 'Products and services they offer' : undefined} style={styles.groupTight} />
        {products.length ? (
          <View style={styles.grid}>
            {products.map((p, i) => {
              const pid = String(p?.id || '');
              const image = resolveMediaUrl(p?.imageUrl || '');
              return (
                <PressableScale
                  key={pid || `${p?.name || 'product'}-${i}`}
                  style={styles.productCell}
                  contentStyle={styles.productShadow}
                  onPress={() => { viewProduct(pid); setAlbumAt(i); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${p?.name || 'Product'}, view photos and details`}
                >
                  <View style={styles.product}>
                    {image ? <FitImage uri={image} style={styles.productImg} /> : (
                      <View style={[styles.productImg, styles.productFallback]}><Icon name="inventory-2" size={SIZE.iconLg} color={PALETTE.borderStrong} /></View>
                    )}
                    <View style={styles.productBody}>
                      <Text style={styles.itemTitle} numberOfLines={2}>{p?.name || 'Product'}</Text>
                      <Text style={styles.sub} numberOfLines={1}>{p?.category ? `Product · ${p.category}` : 'Product'}</Text>
                      {p?.description ? <Text style={styles.desc} numberOfLines={2} maxFontSizeMultiplier={1.3}>{p.description}</Text> : null}
                      {Number(p?.price) > 0 ? <Text style={styles.price}>{money(p.price)}</Text> : null}
                    </View>
                  </View>
                </PressableScale>
              );
            })}
          </View>
        ) : (
          <SurfaceCard style={styles.block}>
            <StateView compact art={<EmptyBox3D size={60} />} title="Nothing listed yet" message="This member has not published any products or services." />
          </SurfaceCard>
        )}
      </FadeInUp>
    </PremiumPage>
      <PhotoViewer url={photo} visible={photoOpen} onClose={() => setPhotoOpen(false)} title={m?.fullName || 'Profile photo'} />
      <CatalogueAlbum items={products} startIndex={albumAt} onClose={() => setAlbumAt(null)} onProductShown={(it) => viewProduct(it.key)} />
    </>
  );
};

const styles = StyleSheet.create({
  overlap: { marginTop: -PREMIUM_OVERLAP },
  block: { marginHorizontal: SPACE.lg },
  groupTight: { marginTop: SPACE.xl },
  sectors: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm },
  fact: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  factLabel: { ...TYPE.eyebrow, fontSize: 10 },
  factValue: { ...TYPE.bodyStrong, marginTop: 2 },
  actionGap: { marginTop: SPACE.md, paddingTop: SPACE.lg, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  self: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, padding: SPACE.md, borderRadius: 14, backgroundColor: PALETTE.blueTint },
  selfText: { ...TYPE.label, color: PALETTE.blueDark, flex: 1 },
  inlineNotice: { marginHorizontal: 0, marginTop: SPACE.md },
  company: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.lg },
  companyDivider: { borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  logo: { width: 46, height: 46, borderRadius: 14, backgroundColor: PALETTE.field, borderWidth: 1, borderColor: PALETTE.border },
  itemTitle: { ...TYPE.bodyStrong },
  sub: { ...TYPE.caption, marginTop: SPACE.xxs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: SPACE.md, marginHorizontal: SPACE.lg },
  productCell: { width: '48.5%' },
  productShadow: {
    flex: 1, borderRadius: 18, backgroundColor: PALETTE.white,
    shadowColor: '#0B1A45', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 14, elevation: 3,
  },
  product: { flex: 1, borderRadius: 18, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.card, overflow: 'hidden' },
  productImg: { width: '100%', aspectRatio: 4 / 3, backgroundColor: PALETTE.field },
  productFallback: { alignItems: 'center', justifyContent: 'center' },
  productBody: { padding: SPACE.md },
  desc: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: SPACE.xs },
  price: { ...TYPE.bodyStrong, color: PALETTE.blueDark, marginTop: SPACE.xs, fontVariant: ['tabular-nums'] },
});

export default DirectoryProfileScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
