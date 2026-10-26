import { useLegacyAppearance } from '../../ui/legacyAppearance';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { getPublicNewsArticle } from '../../services/publicContent';
import { usePublicResource } from '../../services/usePublicResource';
import { BRAND, PALETTE, SPACE, SurfaceCard } from '../../ui';
import { ActionLink, Body, ContentLayout, ExtraFields, Heading, Photo, contentText } from './PublicContentKit';
import { WEBSITE_PATHS } from '../../config/website.config';
import { newsArticlePath, newsAttachments, newsLinks, newsMedia, NewsMedia, newsWebUrl } from '../../utils/newsContent';

const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Only image markup is loaded here. The browser's viewport supports native pinch
// zoom on Android and iOS; document uploads never inherit a cropped card frame.
export const newsImageDocument = (url: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes"><style>html,body{margin:0;background:#fff}img{display:block;width:100%;height:auto;max-height:none;object-fit:contain}</style></head><body><img alt="Full news image" src="${escape(url)}"></body></html>`;


export default function PublicNewsArticleScreen({ slug, navigation }: { slug: string; navigation: any }) {
  const resource = usePublicResource(navigation, 'news:' + slug, signal => getPublicNewsArticle(slug, signal));
  const article = resource.data;
  return <ContentLayout navigation={navigation} title={article?.title || 'ACTIV News'} subtitle={newsMetadata(article)} art="news" resource={resource} readingPanel={false} overlap sharePath={newsArticlePath(article) || WEBSITE_PATHS.article(slug)}>
    {!!article && <NewsArticleContent article={article} navigation={navigation} />}
  </ContentLayout>;
}

/** The same article presentation for guest, member and legacy website routes. */
export function newsMetadata(article: any): string {
  const published = article?.publishedAt ? new Date(article.publishedAt) : null;
  return [article?.category, published && Number.isFinite(published.getTime()) ? published.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '', article?.location].filter(Boolean).join(' · ');
}
export function NewsMediaItem({ media, navigation, cover = false }: { media: NewsMedia; navigation: any; cover?: boolean }) {
  // Videos and external services are opened only after an explicit tap. Images
  // use the existing resized source; the full original opens in PhotoViewer.
  return media.type === 'video' ? <ActionLink navigation={navigation} href={media.url} label={media.alt || 'Open video'} />
    : <Photo url={media.url} alt={media.alt} caption={media.caption} document closeLabel="Close image" edgeToEdge={cover} />;
}

export function NewsResourceLinks({ article, navigation }: { article: any; navigation: any }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  const documents = newsAttachments(article), links = newsLinks(article);
  return documents.length || links.length ? <View style={s.resources}>
    {documents.length > 0 && <View><Heading>Documents</Heading>{documents.map(document => <ActionLink key={document.url} navigation={navigation} href={document.url} label={document.label} filename={document.filename} download />)}</View>}
    {links.length > 0 && <View><Heading>Related links</Heading>{links.map(link => <ActionLink key={link.url} navigation={navigation} href={link.url} label={link.label} />)}</View>}
  </View> : null;
}

export function NewsArticleContent({ article, navigation }: { article: any; navigation: any }) {
  const s = useLegacyAppearance(legacyAppearance_s);
  if (!article) return null;
  const [cover, ...photos] = newsMedia(article);
  const hasResources = newsAttachments(article).length > 0 || newsLinks(article).length > 0;
  const summary = contentText(article.summary), body = contentText(article.body);
  return <View style={s.article}>
    <SurfaceCard padded={false}>
      {!!cover && cover.type !== 'video' && <NewsMediaItem media={cover} navigation={navigation} cover />}
      <View style={s.copy}>
        {!!cover && cover.type === 'video' && <NewsMediaItem media={cover} navigation={navigation} />}
        {!!summary && !!body && summary !== body && <Body value={article.summary} navigation={navigation} style={s.summary} />}
        <Body value={body ? article.body : article.summary} navigation={navigation} />
      </View>
    </SurfaceCard>
    {photos.length > 0 && <SurfaceCard><Heading>More photos & media</Heading>
      {photos.map(photo => <NewsMediaItem key={photo.url} media={photo} navigation={navigation} />)}
    </SurfaceCard>}
    {hasResources && <SurfaceCard><NewsResourceLinks article={article} navigation={navigation} /></SurfaceCard>}
    <ExtraFields fields={article.extraFields} navigation={navigation} />
    <View style={s.resources}>
      <ActionLink navigation={navigation} href={newsWebUrl(article.externalUrl)} label="Read the original source" />
      <ActionLink navigation={navigation} href="/news" label="All news" />
    </View>
  </View>;
}
const s = StyleSheet.create({
  article: { gap: SPACE.lg },
  copy: { padding: SPACE.lg, paddingBottom: SPACE.xs },
  summary: { color: BRAND.navy, fontWeight: '600', fontSize: 16, lineHeight: 25, paddingBottom: SPACE.md, marginBottom: SPACE.lg, borderBottomWidth: 1, borderBottomColor: PALETTE.divider },
  resources: { gap: SPACE.md },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_s = s;
