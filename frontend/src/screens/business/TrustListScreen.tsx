import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Alert, Linking, TextInput } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../../types';
import {
  PALETTE, SPACE, TYPE, shortDate,
  BrandFrame, BrandHeaderBlock, BrandTopBar, BrandHero, GlassIconButton, GlassFigure, PREMIUM_OVERLAP, FadeInUp,
  LiftCard, LiftSearchBar, CompanyLogoTile, ContactMark, ArtEmptyState, TrustShield3D, SearchLens3D, PressableScale,
  GradientButton,
} from '../../ui';
import { resolveMediaUrl } from '../../config/api.config';
import { getTrustList, addToTrustList, removeFromTrustList, errorMessage, Company } from '../../services/businessApi';
import { useMembershipPaid, MembershipLocked } from './MembershipGate';
import { BizStatePage } from './businessKit';

type Props = NativeStackScreenProps<RootStackParamList, 'TrustList'>;

/**
 * MY TRUST LIST — the website's /business/trust-list.
 *
 *   GET    /business-profiles/trust-list        full company cards, newest first
 *   DELETE /business-profiles/trust-list/:id    remove
 *   POST   /business-profiles/trust-list/:id    { note } — writes the note
 *
 * Companies are added from Discover and from a company's public page.
 *
 * The note: the server has always stored a private note (≤ 500 characters)
 * with each trusted company and returns it here, but no screen could write
 * one, so every note was empty. Re-posting the SAME company with a note is
 * how the server updates it (the row is upserted, `note` is $set).
 */

const NOTE_MAX = 500;

function TrustRow({ item, onOpen, onRemove, removing, onSaveNote }: {
  item: Company; onOpen: () => void; onRemove: () => void; removing: boolean;
  onSaveNote: (note: string) => Promise<boolean>;
}) {
  const logo = item?.logo ? resolveMediaUrl(item.logo) : '';
  const place = [item?.area, item?.location].filter(Boolean).join(', ');
  const phone = String(item?.mobileNumber || '').replace(/[^\d+]/g, '');
  const categories = (item?.productCategories || []).filter((c) => c && c.description);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setDraft(String(item?.note || '')); setEditing(true); };
  const save = async () => {
    setSaving(true);
    const ok = await onSaveNote((draft || '').trim().slice(0, NOTE_MAX));
    setSaving(false);
    if (ok) setEditing(false);
  };

  return (
    <LiftCard tone="business" style={styles.card}>
      <View style={styles.row}>
        <PressableScale onPress={onOpen} scaleTo={0.98} style={{ flex: 1, minWidth: 0 }} contentStyle={styles.rowMain} accessibilityRole="button" accessibilityLabel={`Open ${item?.businessName || 'company'}`}>
          <CompanyLogoTile tone="business" uri={logo} name={item?.businessName} size={54} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={1.3}>{item?.businessName || 'Company'}</Text>
            <Text style={styles.sub} numberOfLines={2} maxFontSizeMultiplier={1.3}>{[item?.businessType, place].filter(Boolean).join(' · ') || '—'}</Text>
            <View style={styles.metaRow}>
              <Icon name="star" size={14} color={PALETTE.amber} />
              <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={1.3}>
                Trusted by {Number(item?.trustedBy || 0)}{item?.trustedAt ? ` · added ${shortDate(item.trustedAt)}` : ''}
              </Text>
            </View>
          </View>
        </PressableScale>
        <PressableScale
          onPress={onRemove}
          disabled={removing}
          scaleTo={0.9}
          contentStyle={[styles.remove, removing && { opacity: 0.5 }]}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item?.businessName || 'company'} from trust list`}
        >
          <Icon name="remove-moderator" size={20} color={PALETTE.danger} />
        </PressableScale>
      </View>

      {/* Contact, as the website's trust-list card carries it — the point of
          keeping a supplier is being able to reach them again. */}
      {(phone || item?.email) ? (
        <View style={styles.contactRow}>
          {phone ? (
            <PressableScale onPress={() => Linking.openURL(`tel:${phone}`).catch(() => null)} contentStyle={styles.contactChip} accessibilityRole="button" accessibilityLabel={`Call ${item?.businessName || 'company'}`}>
              <ContactMark kind="call" size={20} />
              <Text style={styles.contactText} maxFontSizeMultiplier={1.3}>{String(item?.mobileNumber || '')}</Text>
            </PressableScale>
          ) : null}
          {item?.email ? (
            <PressableScale onPress={() => Linking.openURL(`mailto:${item?.email || ''}`).catch(() => null)} style={{ flexShrink: 1 }} contentStyle={styles.contactChip} accessibilityRole="button" accessibilityLabel={`Email ${item?.businessName || 'company'}`}>
              <ContactMark kind="email" size={20} />
              <Text style={styles.contactText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{item?.email}</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}

      {categories.length ? (
        <View style={styles.cats}>
          {categories.slice(0, 3).map((c, i) => (
            <View key={`${c?.code || 'c'}-${i}`} style={styles.cat}>
              <Icon name="inventory-2" size={12} color={PALETTE.violet} />
              <Text style={styles.catText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{c?.description}</Text>
            </View>
          ))}
          {categories.length > 3 ? <Text style={styles.catMore}>+{categories.length - 3} more</Text> : null}
        </View>
      ) : null}

      {/* The private note — shown, and now writable, inline (no popup — Rule 2). */}
      {editing ? (
        <View style={styles.noteEdit}>
          <Text style={styles.noteLabel} maxFontSizeMultiplier={1.3}>Your private note</Text>
          <TextInput
            value={draft}
            onChangeText={(t) => setDraft((t || '').slice(0, NOTE_MAX))}
            placeholder="e.g. Reliable on delivery, ask for Ravi in accounts"
            placeholderTextColor={PALETTE.textFaint}
            style={styles.noteInput}
            multiline
            maxLength={NOTE_MAX}
            accessibilityLabel="Private note"
            autoFocus
          />
          <Text style={styles.noteCount} maxFontSizeMultiplier={1.2}>{`${(draft || '').length}/${NOTE_MAX}`}</Text>
          <View style={styles.noteActions}>
            <GradientButton tone="business" label="Cancel" variant="outline" onPress={() => setEditing(false)} disabled={saving} style={{ flex: 1 }} />
            <GradientButton tone="business" label="Save note" icon="check" onPress={save} loading={saving} style={{ flex: 1 }} />
          </View>
        </View>
      ) : item?.note ? (
        <PressableScale onPress={startEdit} contentStyle={styles.noteBox} accessibilityRole="button" accessibilityLabel={`Your note: ${item.note}. Edit`}>
          <Icon name="format-quote" size={18} color={PALETTE.warningText} />
          <Text style={styles.note} numberOfLines={3} maxFontSizeMultiplier={1.3}>{item.note}</Text>
          <Icon name="edit" size={16} color={PALETTE.warningText} />
        </PressableScale>
      ) : (
        <PressableScale onPress={startEdit} contentStyle={styles.addNote} accessibilityRole="button" accessibilityLabel="Add a private note">
          <Icon name="edit-note" size={18} color={PALETTE.violet} />
          <Text style={styles.addNoteText} maxFontSizeMultiplier={1.3}>Add a private note</Text>
        </PressableScale>
      )}
    </LiftCard>
  );
}

const TrustListScreen: React.FC<Props> = ({ navigation }) => {
  const [rows, setRows] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);
  // Website TrustList.tsx: an EMPTY list is an invitation to Discover only for a
  // paid member; to anyone else Discover is a count with no companies, so the
  // empty state becomes the membership panel. A lapsed member keeps their rows.
  const paid = useMembershipPaid();

  const load = useCallback(async (mode: 'load' | 'refresh' = 'load') => {
    if (mode === 'refresh') setRefreshing(true); else setLoading(true);
    try {
      setRows(await getTrustList());
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your trust list.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const shown = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return rows || [];
    // Same haystack as the website: name, type, place, the member's note and the NIC categories.
    return (rows || []).filter((c) =>
      [
        c?.businessName, c?.businessType, c?.area, c?.location, c?.note,
        ...((c?.productCategories || []).map((cat) => cat?.description)),
      ].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [rows, query]);

  const remove = (c: Company) => {
    Alert.alert('Remove from trust list', `Remove ${c?.businessName || 'this company'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingId(c._id);
          try {
            await removeFromTrustList(c._id);
            setRows((prev) => (prev || []).filter((x) => x._id !== c._id));
          } catch (err) {
            Alert.alert('Not removed', errorMessage(err));
          } finally {
            setRemovingId(null);
          }
        },
      },
    ]);
  };

  const saveNote = async (c: Company, note: string): Promise<boolean> => {
    if (!c?._id) return false;
    try {
      await addToTrustList(c._id, note);
      setRows((prev) => (prev || []).map((x) => (x._id === c._id ? { ...x, note } : x)));
      return true;
    } catch (err) {
      Alert.alert('Note not saved', errorMessage(err));
      return false;
    }
  };

  if (loading && !refreshing) return <BizStatePage title="Trust list" eyebrow="Your network" onBack={() => navigation.goBack()} rows={4} />;
  if (error) return <BizStatePage title="Trust list" eyebrow="Your network" onBack={() => navigation.goBack()} error={error} onRetry={() => load()} />;

  const count = (rows || []).length;
  const withNotes = (rows || []).filter((r) => !!(r?.note || '').trim()).length;

  return (
    <BrandFrame tone="business">
      <FlatList
        data={shown}
        keyExtractor={(item, index) => String(item?._id || index)}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        refreshing={refreshing}
        onRefresh={() => load('refresh')}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: SPACE.huge }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            <BrandHeaderBlock tone="business">
              <BrandTopBar
                onBack={() => navigation.goBack()}
                title="Trust list"
                right={<GlassIconButton icon="travel-explore" onPress={() => navigation.navigate('Discover')} accessibilityLabel="Find more in ACTIV Network" />}
              />
              <BrandHero
                eyebrow="Your network"
                title={`${count} trusted compan${count === 1 ? 'y' : 'ies'}`}
                subtitle="Businesses you have worked with and would vouch for."
                art={<TrustShield3D tone="business" size={92} />}
                artSize={92}
              >
                {count > 0 ? (
                  <View style={styles.figures}>
                    <GlassFigure icon="verified-user" value={String(count)} label="Trusted" />
                    <GlassFigure icon="edit-note" value={String(withNotes)} label="With notes" />
                  </View>
                ) : null}
              </BrandHero>
            </BrandHeaderBlock>
            <View style={styles.overlap}>
              {count > 0 ? (
                <LiftSearchBar tone="business" value={query} onChangeText={setQuery} placeholder="Filter by name, type, place or note…" style={styles.filter} />
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          !count && paid !== true ? (
            <MembershipLocked
              icon="verified-user"
              title="Your trust list opens with membership"
              message="A trust list is the suppliers you have dealt with and would deal with again — kept in one place, and visible to the members deciding whether to deal with you."
              perks={[
                { icon: 'add-moderator', title: 'Keep who you trust', detail: 'Add a company from ACTIV Network and it stays until you remove it.' },
                { icon: 'visibility', title: 'Be kept by others', detail: 'Your company shows how many members trust it — on every screen it appears.' },
                { icon: 'storefront', title: 'Reach them directly', detail: 'Names, catalogues and telephone numbers, across the whole network.' },
              ]}
              onJoin={() => navigation.navigate('MemberMain')}
              footnote="Your account and your products stay exactly as they are."
              style={{ marginTop: 0 }}
            />
          ) : (
            <LiftCard tone="business" style={styles.gutter}>
              <ArtEmptyState tone="business"
                compact
                art={count ? <SearchLens3D tone="business" size={74} /> : <TrustShield3D tone="business" size={78} />}
                title={count ? `Nothing matches “${(query || '').trim()}”` : 'Your trust list is empty'}
                message={count ? 'Clear the filter to see all of them, or search the whole network in ACTIV Network.' : 'Search the network in ACTIV Network and add the companies you want to keep. They stay here until you remove them.'}
                action={count ? undefined : 'Explore ACTIV Network'}
                actionIcon="travel-explore"
                onAction={count ? undefined : () => navigation.navigate('Discover')}
              />
            </LiftCard>
          )
        }
        renderItem={({ item, index }) => (
          <FadeInUp delay={Math.min(index, 5) * 60} distance={12}>
            <TrustRow
              item={item}
              removing={removingId === item?._id}
              onOpen={() => navigation.navigate('CompanyPublic', { companyId: item._id })}
              onRemove={() => remove(item)}
              onSaveNote={(note) => saveNote(item, note)}
            />
          </FadeInUp>
        )}
      />
    </BrandFrame>
  );
};

const styles = StyleSheet.create({
  gutter: { marginHorizontal: SPACE.lg },
  overlap: { marginTop: -PREMIUM_OVERLAP, marginBottom: SPACE.md },
  figures: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg, marginBottom: SPACE.sm },
  filter: { marginHorizontal: SPACE.lg },
  card: { marginHorizontal: SPACE.lg, marginBottom: SPACE.md },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm },
  rowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md },
  name: { ...TYPE.heading },
  sub: { ...TYPE.caption, marginTop: SPACE.xxs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs },
  meta: { ...TYPE.caption, color: PALETTE.amberDark, fontWeight: '700', flexShrink: 1 },
  remove: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md },
  contactChip: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs + 2, minHeight: 40, maxWidth: '100%', paddingLeft: 6, paddingRight: SPACE.md, borderRadius: 999, backgroundColor: PALETTE.fieldBg, borderWidth: 1, borderColor: PALETTE.border },
  contactText: { ...TYPE.caption, fontWeight: '700', color: PALETTE.textSoft, flexShrink: 1 },
  cats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SPACE.xs + 2, marginTop: SPACE.sm },
  cat: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, maxWidth: '100%', paddingHorizontal: SPACE.sm, paddingVertical: SPACE.xs, borderRadius: 8, backgroundColor: PALETTE.violetTint },
  catText: { ...TYPE.caption, fontSize: 11, lineHeight: 15, color: PALETTE.textSoft, flexShrink: 1 },
  catMore: { ...TYPE.caption, fontSize: 11, color: PALETTE.textFaint },
  noteBox: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xs, marginTop: SPACE.md, backgroundColor: PALETTE.warningSoft, borderRadius: 14, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm },
  note: { ...TYPE.body, flex: 1, minWidth: 0, fontStyle: 'italic', color: PALETTE.warningText },
  addNote: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, minHeight: 40, marginTop: SPACE.sm, alignSelf: 'flex-start' },
  addNoteText: { fontSize: 13, lineHeight: 18, fontWeight: '700', color: PALETTE.violet },
  noteEdit: { marginTop: SPACE.md, paddingTop: SPACE.md, borderTopWidth: 1, borderTopColor: PALETTE.divider },
  noteLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: PALETTE.textSoft, marginBottom: SPACE.sm },
  noteInput: { minHeight: 96, borderRadius: 14, borderWidth: 1.5, borderColor: PALETTE.violet, backgroundColor: PALETTE.white, paddingHorizontal: SPACE.md, paddingTop: SPACE.md, paddingBottom: SPACE.md, fontSize: 15, color: PALETTE.text, textAlignVertical: 'top' },
  noteCount: { ...TYPE.caption, textAlign: 'right', marginTop: SPACE.xs },
  noteActions: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.sm },
});

export default TrustListScreen;
