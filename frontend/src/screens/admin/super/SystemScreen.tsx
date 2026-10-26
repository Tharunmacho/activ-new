import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import api, { STORAGE_KEYS } from '../../../services/api';
import { resolveMediaUrl } from '../../../config/api.config';
import { useSuperAdminData } from './context/SuperAdminContext';
import { useSuperAdminBack } from './useSuperAdminBack';
import LinearGradient from 'react-native-linear-gradient';
import {
  BottomActionBar, PALETTE, SPACE, TYPE, SIZE,
  ConsoleFrame, ConsoleHeader, ConsoleCard, ConsoleChip, ConsoleTabs, ConsoleSearch, ConsoleButton, ConsolePill,
  ConsoleSectionTitle, ConsoleCountUp, GradientAvatar, PremiumSection, PremiumInput, PressableScale,
  FadeInUp, AuditLog3D, ProfileGear3D, CONSOLE_LIST, CONSOLE_ACCENTS,
} from '../../../ui';
import { SkeletonList } from './components/Skeleton';
import EmptyState from './components/EmptyState';
import { MenuButton } from '../shared/TierMenu';

type Category = 'all' | 'application' | 'admin' | 'event' | 'authentication' | 'content';

interface AuditEntry {
  id: string;
  action: string;
  category: string;
  summary: string;
  actorName: string;
  actorEmail: string;
  actorRoleLabel: string;
  proxy: boolean;
  targetLabel: string;
  location: string;
  createdAt: string | null;
}

const CATEGORY_TABS: { key: Category; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'application', label: 'Apps' },
  { key: 'admin', label: 'Admins' },
  { key: 'event', label: 'Events' },
        { key: 'authentication', label: 'Sign-ins' },
        { key: 'content', label: 'Updates' },
];

const ACTION_ICON: Record<string, { icon: string; fg: string; bg: string }> = {
  'application.approved': { icon: 'check-circle', fg: PALETTE.successText, bg: PALETTE.successSoft },
  'application.rejected': { icon: 'cancel', fg: PALETTE.dangerText, bg: PALETTE.dangerSoft },
  'admin.created': { icon: 'person-add', fg: PALETTE.indigo, bg: PALETTE.indigoSoft },
  'admin.updated': { icon: 'edit', fg: PALETTE.warningText, bg: PALETTE.warningSoft },
  'admin.deleted': { icon: 'person-remove', fg: PALETTE.dangerText, bg: PALETTE.dangerSoft },
  'event.created': { icon: 'event', fg: PALETTE.indigo, bg: PALETTE.indigoSoft },
  'event.published': { icon: 'campaign', fg: PALETTE.successText, bg: PALETTE.successSoft },
  'event.unpublished': { icon: 'visibility-off', fg: PALETTE.textMuted, bg: PALETTE.field },
  'event.deleted': { icon: 'delete-outline', fg: PALETTE.dangerText, bg: PALETTE.dangerSoft },
};

const PAGE_SIZE = 30;
const SEARCH_DEBOUNCE_MS = 350;

/** `22 Aug 2026, 14:30` — the audit stream needs the time, not just the day. */
const formatStamp = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

/** `22 Aug 2026` — the timeline's day headings. */
const dayLabel = (value?: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};

/**
 * Settings: the profile card and sign-out the tier admins have, plus the audit
 * log — the record of who approved, rejected or deleted what.
 */
const SystemScreen = ({ navigation }: any) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const CONSOLE_ACCENTS = useLegacyAppearance(legacyAppearance_CONSOLE_ACCENTS);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const {
    adminName, adminEmail, adminPhone, updateAdminProfile,
    adminProfilePhoto, setAdminProfilePhoto, stats,
  } = useSuperAdminData();

  // Profile editing, matching the tier admins' settings screens field for field.
  // The one difference is that there is no region input: a super admin is not
  // geofenced, so there is nothing here to scope them to.
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [nameInput, setNameInput] = useState(adminName);
  const [emailInput, setEmailInput] = useState(adminEmail);
  const [phoneInput, setPhoneInput] = useState(adminPhone);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [revealed, setRevealed] = useState<{ [label: string]: boolean }>({});

  useEffect(() => {
    setNameInput(adminName);
    setEmailInput(adminEmail);
    setPhoneInput(adminPhone);
  }, [adminName, adminEmail, adminPhone]);

  const handleSaveProfile = async () => {
    // The website ProfileEditModal's checks, before anything is sent.
    const name = (nameInput || '').trim();
    const email = (emailInput || '').trim();
    if (!name) return Alert.alert('Validation Error', 'Please enter your full name.');
    if (!email) return Alert.alert('Validation Error', 'Please enter your email.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Alert.alert('Validation Error', 'Please enter a valid email address.');
    }
    if (newPassword || oldPassword || confirmPassword) {
      if (!oldPassword) return Alert.alert('Validation Error', 'Please enter your current password.');
      if (!newPassword) return Alert.alert('Validation Error', 'Please enter a new password.');
      if (newPassword.length < 6) return Alert.alert('Validation Error', 'New password must be at least 6 characters.');
      if (newPassword !== confirmPassword) {
        return Alert.alert('Validation Error', 'New password and confirm password do not match.');
      }
      if (oldPassword === newPassword) {
        return Alert.alert('Validation Error', 'New password must be different from current password.');
      }
    }

    setIsSaving(true);
    let changed = 0;
    let passwordChanged = false;
    try {
      if (name !== adminName || email !== adminEmail || phoneInput !== adminPhone) {
        // `phoneNumber` is sent even when blank: the server reads the KEY's
        // presence, so an emptied number is a removal, not "unchanged".
        await api.put('/admin/profile', {
          fullName: name,
          email,
          phoneNumber: (phoneInput || '').trim(),
        });
        updateAdminProfile(name, email, (phoneInput || '').trim());
        changed += 1;
      }

      if (newPassword) {
        await api.post('/auth/change-password', { oldPassword, newPassword });
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        changed += 1;
        passwordChanged = true;
      }

      if (passwordChanged) {
        Alert.alert('Success', 'Password updated successfully! Please use your new password next time you sign in.');
      } else if (changed > 0) {
        Alert.alert('Success', 'Profile updated successfully!');
      }
      setIsEditing(false);
      setRevealed({});
    } catch (error: any) {
      Alert.alert('Error', error?.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  /** Same field renderer as the tier screens, with the password reveal toggle. */
  const renderField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    options: { secure?: boolean; keyboard?: any; capitalize?: any; icon?: string } = {},
  ) => {
    const shown = !!options.secure && !!revealed[label];
    return (
      <PremiumInput
        key={label}
        tone="admin"
        label={label}
        icon={options.icon}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={!!options.secure && !shown}
        keyboardType={options.keyboard || 'default'}
        autoCapitalize={options.capitalize || 'words'}
        autoCorrect={false}
        editable={isEditing}
        right={options.secure ? (
          <TouchableOpacity
            style={styles.revealBtn}
            onPress={() => setRevealed(prev => ({ ...prev, [label]: !prev[label] }))}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          >
            <Icon name={shown ? 'visibility-off' : 'visibility'} size={SIZE.icon} color={PALETTE.textFaint} />
          </TouchableOpacity>
        ) : undefined}
      />
    );
  };

  const [tab, setTab] = useState<'audit' | 'profile'>('profile');
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const params = useMemo(
    () => {
      const q = (debouncedQuery || '').trim();
      return {
        limit: PAGE_SIZE,
        ...(category !== 'all' ? { category } : {}),
        ...(q.length >= 2 ? { q } : {}),
      };
    },
    [category, debouncedQuery],
  );

  const fetchPage = useCallback(async (nextPage: number, mode: 'replace' | 'append' | 'refresh') => {
    if (mode === 'append') setLoadingMore(true);
    else if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);

    try {
      const [logResponse, countResponse] = await Promise.all([
        api.get('/audit', { params: { ...params, page: nextPage } }),
        nextPage === 1 ? api.get('/audit/counts').catch(() => null) : Promise.resolve(null),
      ]);

      const payload = logResponse.data?.data || logResponse.data || {};
      const rows: AuditEntry[] = payload.entries || [];
      const pagination = payload.pagination || {};

      setEntries(prev => (mode === 'append' ? [...(prev || []), ...rows] : rows));
      setPage(Number(pagination.page || nextPage));
      setPages(Number(pagination.pages || 1));
      setTotal(Number(pagination.total || rows.length));
      if (countResponse) setCounts(countResponse.data?.data || countResponse.data || {});
      setError('');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load the audit log');
      if (mode !== 'append') setEntries([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [params]);

  useEffect(() => {
    if (tab === 'audit') fetchPage(1, 'replace');
  }, [tab, fetchPage]);

  const handleLogout = useCallback(() => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([
              STORAGE_KEYS.AUTH_TOKEN,
              STORAGE_KEYS.USER_DATA,
              STORAGE_KEYS.USER_ROLE,
            ]);
          } catch {
            // A storage failure must not trap the admin in the console.
          }
          navigation.reset({ index: 0, routes: [{ name: 'AdminLogin' }] });
        },
      },
    ]);
  }, [navigation]);

  const keyExtractor = useCallback(
    (item: AuditEntry, index: number) => String(item?.id || index),
    [],
  );

  const renderItem = useCallback(({ item, index }: { item: AuditEntry; index: number }) => {
    const tone = ACTION_ICON[item?.action] || { icon: 'history', fg: PALETTE.textMuted, bg: PALETTE.field };
    // A day heading whenever the day changes — the log reads as a timeline.
    const day = dayLabel(item?.createdAt);
    const prevDay = index > 0 ? dayLabel(entries?.[index - 1]?.createdAt) : '';
    const showDay = !!day && day !== prevDay;
    const last = index === (entries || []).length - 1;
    return (
      <View style={styles.gutter}>
        {showDay ? (
          <View style={styles.dayRow}>
            <View style={styles.dayDot} />
            <Text style={styles.dayText}>{day}</Text>
          </View>
        ) : null}
        <View style={styles.entryRow}>
          <View style={styles.rail}>
            <View style={[styles.entryIcon, { backgroundColor: tone.bg }]}>
              <Icon name={tone.icon} size={18} color={tone.fg} />
            </View>
            {!last ? <View style={styles.railLine} /> : null}
          </View>
          <ConsoleCard style={styles.entryCard}>
            <Text style={styles.entrySummary}>{item?.summary || item?.action || 'Action recorded'}</Text>
            <View style={styles.entryMetaRow}>
              <Icon name="person" size={14} color={PALETTE.textFaint} />
              <Text style={styles.entryMeta} numberOfLines={2}>
                {[item?.actorName || item?.actorEmail, item?.actorRoleLabel, item?.location].filter(Boolean).join(' · ') || 'Unknown actor'}
              </Text>
            </View>
            <View style={styles.entryFooter}>
              <Icon name="schedule" size={14} color={PALETTE.textFaint} />
              <Text style={styles.entryStamp}>{formatStamp(item?.createdAt) || 'Unknown time'}</Text>
              {item?.proxy ? <ConsoleChip label="Proxy" kind="warning" /> : null}
            </View>
          </ConsoleCard>
        </View>
      </View>
    );
  }, [entries]);

  const listFooter = () => {
    if (tab !== 'audit') return null;
    if (loadingMore) return <ActivityIndicator style={styles.more} size="small" color={PALETTE.indigo} />;
    if (page < pages) {
      return (
        <ConsoleButton kind="soft" icon="expand-more" label="Load more" onPress={() => fetchPage(page + 1, 'append')} style={styles.loadMore} />
      );
    }
    return null;
  };

  const listEmpty = () => {
    if (tab !== 'audit') return null;
    if (loading) return <View style={styles.gutter}><SkeletonList count={5} /></View>;
    if (error) {
      return <EmptyState tone="error" title={error} caption="Pull down to try again." action="Try again" onAction={() => fetchPage(1, 'replace')} />;
    }
    return (
      <EmptyState
        title={(query || '').trim() || category !== 'all' ? 'Nothing matches that filter' : 'No activity recorded yet'}
        caption="Approvals, rejections and admin changes appear here as they happen."
      />
    );
  };

  /**
   * Unwind what is open, innermost first: an in-progress profile edit, then the
   * audit tab, then the tab itself. Backing out of an edit discards it rather
   * than saving — the same as the Cancel path — so back is never a silent write.
   */
  const goBack = useSuperAdminBack(
    useCallback(() => {
      if (isEditing) {
        setIsEditing(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setRevealed({});
        setNameInput(adminName);
        setEmailInput(adminEmail);
        setPhoneInput(adminPhone);
        return true;
      }
      if (tab !== 'profile') {
        setTab('profile');
        return true;
      }
      return false;
    }, [isEditing, tab, adminName, adminEmail, adminPhone]),
  );

  const handlePhotoUpload = async () => {
    try {
      if (typeof launchImageLibrary !== 'function') return;
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
      });

      if (result.didCancel || !result.assets || result.assets.length === 0) return;

      const asset = result.assets[0];
      
      const formData = new FormData();
      formData.append('photo', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'profile.jpg',
      } as any);

      setUploading(true);
      const res = await api.post('/admin/super/profile/photo', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success && res.data.data.profilePhoto) {
        setAdminProfilePhoto(res.data.data.profilePhoto);
        Alert.alert('Success', 'Profile photo updated successfully');
      } else {
        throw new Error('Failed to update profile photo');
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.response?.data?.message || err.message || 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const renderProfile = () => (
    <View>
      {/* Profile card, lifted over the waves. */}
      <FadeInUp style={styles.overlap}>
        <ConsoleCard>
          <View style={styles.profileRow}>
            <PressableScale onPress={handlePhotoUpload} disabled={uploading} scaleTo={0.94} accessibilityRole="button" accessibilityLabel="Change photo">
              <GradientAvatar
                name={adminName || 'Super Admin'}
                uri={adminProfilePhoto ? resolveMediaUrl(adminProfilePhoto) : ''}
                size={AVATAR}
                tone="admin"
              />
              <LinearGradient colors={CONSOLE_ACCENTS.indigo.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cameraIconBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color={PALETTE.white} />
                ) : (
                  <Icon name="camera-alt" size={14} color={PALETTE.white} />
                )}
              </LinearGradient>
            </PressableScale>
            <View style={styles.flexText}>
              <Text style={styles.profileName} numberOfLines={2}>{adminName || 'Super Admin'}</Text>
              <Text style={styles.profileRole}>Super Admin</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{adminEmail || 'No email on this account'}</Text>
              <View style={styles.profileMetaRow}>
                {/* A super admin is not geofenced — the website says the same. */}
                <ConsoleChip label="All India" kind="info" icon="public" />
                <ConsoleChip label="Active" kind="approved" />
              </View>
            </View>
          </View>
        </ConsoleCard>
      </FadeInUp>

      <FadeInUp delay={100}>
        <PremiumSection
          tone="admin"
          icon="badge"
          title="Profile Information"
          subtitle={isEditing ? 'Editing — save with the button below' : 'Tap Edit to change your details'}
        >
          {!isEditing ? (
            <View style={styles.editRow}>
              <ConsolePill icon="edit" label="Edit profile" onPress={() => setIsEditing(true)} disabled={isSaving} />
            </View>
          ) : null}

          {renderField('Full Name', nameInput, setNameInput, 'Enter your name', { icon: 'person-outline' })}
          {renderField('Email Address', emailInput, setEmailInput, 'Enter your email', {
            keyboard: 'email-address', capitalize: 'none', icon: 'mail-outline',
          })}
          {renderField('Mobile Number', phoneInput, setPhoneInput, 'Enter your mobile number', {
            keyboard: 'phone-pad', icon: 'phone',
          })}

          {isEditing ? (
            <>
              <View style={styles.rule} />
              <Text style={styles.groupLabel}>Change password (optional)</Text>
              {renderField('Current Password', oldPassword, setOldPassword, 'Enter current password', {
                secure: true, capitalize: 'none', icon: 'lock-outline',
              })}
              {renderField('New Password', newPassword, setNewPassword, 'Leave blank to keep', {
                secure: true, capitalize: 'none', icon: 'lock-reset',
              })}
              {newPassword ? renderField('Confirm New Password', confirmPassword, setConfirmPassword, 'Confirm new password', {
                secure: true, capitalize: 'none', icon: 'lock-outline',
              }) : null}
            </>
          ) : null}
        </PremiumSection>
      </FadeInUp>

      <ConsoleSectionTitle icon="insights" title="Platform" subtitle="Live figures from the overview" style={styles.sectionTight} />
      <FadeInUp delay={160} style={styles.gutter}>
        <ConsoleCard>
          <View style={styles.platformRow}>
            {[
              { icon: 'groups', label: 'Total members', value: stats.totalMembers, accent: 'indigo' as const },
              { icon: 'description', label: 'Applications', value: stats.totalApplications, accent: 'amber' as const },
              { icon: 'admin-panel-settings', label: 'Admin accounts', value: stats.totalAdmins, accent: 'green' as const },
            ].map((row, index) => {
              const a = CONSOLE_ACCENTS[row.accent];
              return (
                <View key={row.label} style={[styles.platformCell, index > 0 && styles.platformDivider]}>
                  <LinearGradient colors={a.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.platformIcon}>
                    <Icon name={row.icon} size={18} color={PALETTE.white} />
                  </LinearGradient>
                  <ConsoleCountUp value={Number(row.value || 0)} style={[styles.platformValue, { color: a.fg }]} />
                  <Text style={styles.platformLabel} numberOfLines={2}>{row.label}</Text>
                </View>
              );
            })}
          </View>
        </ConsoleCard>
      </FadeInUp>

      {!isEditing ? (
        <FadeInUp delay={220} style={styles.logout}>
          <ConsoleButton kind="danger" icon="logout" label="Log Out" onPress={handleLogout} />
        </FadeInUp>
      ) : null}
    </View>
  );

  const footer = tab === 'profile' && isEditing ? (
    <BottomActionBar safeBottom={false}>
      <ConsoleButton kind="soft" label="Cancel" onPress={() => goBack()} style={styles.flex} />
      <ConsoleButton icon="check" label="Save changes" loading={isSaving} onPress={handleSaveProfile} style={styles.flex} />
    </BottomActionBar>
  ) : undefined;

  const header = (
    <View>
      <ConsoleHeader
        left={<MenuButton />}
        topCenter="Super Admin"
        eyebrow={tab === 'audit' ? `${total} recorded actions` : 'Your account'}
        title={tab === 'audit' ? 'Audit log' : 'Settings'}
        subtitle={tab === 'audit' ? 'Who approved, rejected, created or deleted what — and when' : 'Profile, password and the system log'}
        art={tab === 'audit' ? <AuditLog3D size={96} /> : <ProfileGear3D size={92} />}
        waveHeight={tab === 'profile' ? 62 : 58}
      >
        <ConsoleTabs
          value={tab}
          onChange={setTab}
          options={[{ value: 'profile', label: 'Profile' }, { value: 'audit', label: 'Audit Log' }]}
          style={styles.headerTabs}
        />
      </ConsoleHeader>

      {tab === 'profile' ? renderProfile() : (
        <View>
          <ConsoleSearch value={query} onChangeText={setQuery} placeholder="Who did what — name, email or applicant" />
          <ConsoleTabs
            value={category}
            onChange={setCategory}
            options={CATEGORY_TABS.map(item => {
              const count = item.key === 'all' ? counts.all : counts[item.key];
              return { value: item.key, label: item.label, ...(count !== undefined ? { count: Number(count || 0) } : {}) };
            })}
            style={styles.categoryTabs}
          />
        </View>
      )}
    </View>
  );

  return (
    <ConsoleFrame footer={footer} avoidKeyboard>
      <FlatList
        data={tab === 'audit' ? (entries || []) : []}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={CONSOLE_LIST}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        refreshControl={tab === 'audit'
          ? <RefreshControl refreshing={refreshing} onRefresh={() => fetchPage(1, 'refresh')} colors={[PALETTE.indigo]} tintColor={PALETTE.white} />
          : undefined}
      />
    </ConsoleFrame>
  );
};

const AVATAR = 76;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexText: { flex: 1, minWidth: 0 },
  gutter: { marginHorizontal: SPACE.lg },
  overlap: { marginTop: -30, marginHorizontal: SPACE.lg, marginBottom: SPACE.lg },
  headerTabs: { paddingHorizontal: 0, marginBottom: SPACE.sm },
  categoryTabs: { marginTop: SPACE.md, marginBottom: SPACE.md },
  revealBtn: { paddingLeft: SPACE.sm, minHeight: SIZE.touch, justifyContent: 'center' },
  sectionTight: { marginTop: SPACE.xs },

  profileRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.lg },
  cameraIconBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: PALETTE.card,
  },
  profileName: { ...TYPE.title },
  profileRole: { ...TYPE.label, color: PALETTE.indigo, marginTop: SPACE.xxs },
  profileEmail: { ...TYPE.caption, marginTop: SPACE.xxs },
  profileMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACE.sm, flexWrap: 'wrap' },
  editRow: { flexDirection: 'row', marginTop: -SPACE.sm, marginBottom: SPACE.md },
  rule: { height: StyleSheet.hairlineWidth * 2, backgroundColor: PALETTE.divider, marginBottom: SPACE.lg },
  groupLabel: { ...TYPE.eyebrow, color: PALETTE.indigoDark, marginBottom: SPACE.sm },

  platformRow: { flexDirection: 'row' },
  platformCell: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: SPACE.xs },
  platformDivider: { borderLeftWidth: StyleSheet.hairlineWidth * 2, borderLeftColor: PALETTE.divider },
  platformIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  platformValue: { ...TYPE.number, fontSize: 22, lineHeight: 28, marginTop: SPACE.sm },
  platformLabel: { ...TYPE.caption, fontSize: 11, textAlign: 'center', marginTop: 2 },
  logout: { marginHorizontal: SPACE.lg, marginTop: SPACE.xl },

  dayRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm, marginBottom: SPACE.sm },
  dayDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PALETTE.indigo, marginLeft: 15 },
  dayText: { ...TYPE.eyebrow, color: PALETTE.indigoDark },
  entryRow: { flexDirection: 'row', gap: SPACE.md },
  rail: { width: 40, alignItems: 'center' },
  railLine: { flex: 1, width: 2, backgroundColor: PALETTE.border, marginTop: 4 },
  entryIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  entryCard: { flex: 1, minWidth: 0, marginBottom: SPACE.md },
  entrySummary: { ...TYPE.bodyStrong },
  entryMetaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.sm - 2 },
  entryMeta: { flex: 1, minWidth: 0, ...TYPE.caption },
  entryFooter: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.xs, flexWrap: 'wrap' },
  entryStamp: { ...TYPE.caption, fontSize: 11, color: PALETTE.textFaint },
  more: { marginVertical: SPACE.xl },
  loadMore: { marginHorizontal: SPACE.lg, marginBottom: SPACE.lg },
});

export default SystemScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_ACCENTS = CONSOLE_ACCENTS;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;
