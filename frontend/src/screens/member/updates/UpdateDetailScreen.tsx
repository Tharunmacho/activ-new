import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  Skeleton, Badge, BottomActionBar, PALETTE, SPACE, SIZE, TYPE, shortDate, timeAgo, BRAND,
  PremiumPage, PremiumPageHeader, PREMIUM_OVERLAP, GlassIconButton, Megaphone3D,
  SurfaceCard, GradientGlyph, GradientButton, StateView, FadeInUp, FitImage } from '../../../ui';
import { getAnnouncement } from '../../../services/memberApi';
import { resolveMediaUrl } from '../../../config/api.config';
import { useLoad } from '../useLoad';
import { useCategoryStyle, categoryGlyph, htmlToText } from './updateFormat';
import { openWebsitePage } from '../../../services/websiteNavigation';
import { Body } from '../../public/PublicContentKit';
import { updateAudienceLabel } from '../../../utils/memberAudience';
import { sharePublicPage } from '../../../services/contentShare';

/**
 * One Association Update — website `features/member/pages/AnnouncementDetail.tsx`.
 * GET /announcements/:id (the server refuses one not meant for this member).
 * The banner is shown whole (contain) — it is often a scanned circular where
 * the text IS the content.
 */
const UpdateDetailScreen = ({ navigation, route }: any) => {
  const categoryStyle = useCategoryStyle();
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const id = String(route?.params?.id || '');
  const { data: update, loading, error, reload, refreshing, refresh } = useLoad<any>(() => (id ? getAnnouncement(id) : Promise.resolve(null)), [id], null);

  const style = update ? categoryStyle(update?.category) : null;
  const glyph = categoryGlyph(update?.category);
  const banner = resolveMediaUrl(update?.bannerUrl);
  const attachment = resolveMediaUrl(update?.attachmentUrl);
  const body = htmlToText(update?.body);
  const published = shortDate(update?.publishedAt);
  const ago = timeAgo(update?.publishedAt);

  const openAttachment = async () => {
    if (!attachment) return;
    openWebsitePage(navigation, attachment, update?.attachmentLabel || 'Attachment');
  };

  // The server personalizes this content for the signed-in recipient. Share
  // only its gated address; the receiving member must pass the same checks.
  const share = () => sharePublicPage({ path: '/member/updates/' + encodeURIComponent(id), title: 'ACTIV member update' });

  const header = (
    <PremiumPageHeader
      eyebrow="Association Updates"
      title={style ? style.label : 'Update'}
      subtitle={update ? [ago ? `Published ${ago}` : '', update?.targetLabel ? `For ${update.targetLabel}` : updateAudienceLabel(update?.audience)].filter(Boolean).join(' · ') : loading ? 'Opening the notice…' : undefined}
      onBack={() => navigation.goBack()}
      right={update ? <GlassIconButton icon="share" onPress={share} accessibilityLabel="Share update" /> : undefined}
      art={<Megaphone3D size={84} />}
      artSize={84}
    />
  );

  const footer = update && !loading && attachment ? (
    <BottomActionBar>
      <GradientButton label="Open attachment" icon="file-download" onPress={openAttachment} style={styles.flex} />
    </BottomActionBar>
  ) : undefined;

  return (
    <PremiumPage header={header} footer={footer} refreshing={refreshing} onRefresh={id ? refresh : undefined}>
      {loading ? (
        <View style={styles.overlap}>
          <SurfaceCard style={styles.gutter} contentStyle={{ gap: SPACE.md }}>
            <Skeleton width="35%" height={20} radius={999} />
            <Skeleton width="90%" height={24} />
            <Skeleton width="50%" height={12} />
            <Skeleton width="100%" height={12} />
            <Skeleton width="100%" height={12} />
            <Skeleton width="80%" height={12} />
          </SurfaceCard>
        </View>
      ) : error || !update ? (
        <SurfaceCard style={[styles.gutter, styles.overlap]}>
          <StateView
            compact
            kind={error ? 'error' : 'empty'}
            art={error ? undefined : <Megaphone3D size={64} />}
            title="This update is not available"
            message={error || 'It may have been withdrawn, or it was never for your region.'}
            action={error ? 'Try again' : 'All updates'}
            onAction={() => (error ? reload() : navigation.navigate('AssociationUpdates'))}
          />
        </SurfaceCard>
      ) : (
        <FadeInUp delay={120} style={styles.overlap}>
          <SurfaceCard padded={false} style={styles.gutter} accent={update?.pinned ? '#BFD4FB' : undefined}>
            {banner ? <FitImage uri={banner} mode="auto" minRatio={1.2} maxRatio={2.6} accessibilityLabel={update?.bannerAlt || ''} /> : null}
            <View style={styles.body}>
              <View style={styles.metaRow}>
                {!banner ? <GradientGlyph icon={glyph.icon} tone={glyph.tone} size={36} /> : null}
                {style ? <Badge label={style.label} color={style.fg} bg={style.bg} /> : null}
                {update?.pinned ? <Badge label="Pinned" icon="push-pin" color={PALETTE.blueDark} bg={PALETTE.blueSoft} /> : null}
                {published ? <Text style={styles.date} numberOfLines={1}>{published}</Text> : null}
              </View>
              <Text style={styles.title} selectable maxFontSizeMultiplier={1.3}>{update?.title || 'Update'}</Text>
              <View style={styles.target}>
                <Icon name="place" size={SIZE.iconSm} color={PALETTE.textMuted} />
                <Text style={styles.targetText}>{update?.targetLabel ? `For ${update.targetLabel}` : updateAudienceLabel(update?.audience)}</Text>
              </View>
              {update?.summary ? (
                <View style={styles.summaryBox}>
                  <Icon name="format-quote" size={20} color={PALETTE.blue} />
                  <Text style={styles.summary} selectable>{update.summary}</Text>
                </View>
              ) : null}
              {body ? <Body value={update.body} navigation={navigation} /> : null}
              {attachment ? (
                <TouchableOpacity style={styles.attach} onPress={openAttachment} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`Open ${update?.attachmentLabel || 'attachment'}`}>
                  <GradientGlyph icon="attach-file" tone="blue" size={40} />
                  <View style={styles.flexMin}>
                    <Text style={styles.attachText} numberOfLines={1}>{update?.attachmentLabel || 'Attachment'}</Text>
                    <Text style={styles.attachSub}>Tap to open</Text>
                  </View>
                  <Icon name="file-download" size={SIZE.icon} color={PALETTE.blue} />
                </TouchableOpacity>
              ) : null}
            </View>
          </SurfaceCard>
        </FadeInUp>
      )}
    </PremiumPage>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexMin: { flex: 1, minWidth: 0 },
  overlap: { marginTop: -PREMIUM_OVERLAP },
  gutter: { marginHorizontal: SPACE.lg },
  banner: { width: '100%', aspectRatio: 16 / 10, backgroundColor: PALETTE.field },
  body: { padding: SPACE.lg + 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' },
  date: { ...TYPE.caption, color: PALETTE.textFaint, marginLeft: 'auto' },
  title: { ...TYPE.title, fontSize: 22, lineHeight: 29, color: BRAND.navy, marginTop: SPACE.md },
  target: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm },
  targetText: { ...TYPE.caption, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  summaryBox: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg, padding: SPACE.md, borderRadius: 16, backgroundColor: PALETTE.blueTint, borderWidth: 1, borderColor: PALETTE.blueSoft },
  summary: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22, fontWeight: '600', color: PALETTE.textSoft },
  text: { fontSize: 16, lineHeight: 25, color: PALETTE.textSoft, marginTop: SPACE.lg },
  attach: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.xl, padding: SPACE.md, minHeight: SIZE.row, borderRadius: 16, borderWidth: 1, borderColor: PALETTE.border, backgroundColor: PALETTE.fieldBg },
  attachText: { ...TYPE.bodyStrong },
  attachSub: { ...TYPE.caption, marginTop: 1 },
});

export default UpdateDetailScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
