import { useLegacyAppearance } from '../../../ui/legacyAppearance';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {
  BottomActionBar, PALETTE, SPACE, TYPE, SIZE, shortDate,
  ConsoleFrame, ConsoleHeader, ConsoleCard, ConsoleChip, ConsoleTabs, ConsoleSearch, ConsoleButton, ConsoleNote,
  GradientAvatar, GlassIconButton, PremiumInput, FadeInUp, TeamKeys3D, CONSOLE_LIST, CONSOLE_ACCENTS, ConsoleChipKind,
} from '../../../ui';
import api from '../../../services/api';
import { listStaffAccounts, updateStaffAccount, errorText, type StaffAccount } from '../../../services/superApi';
import { getGeography, invalidateRegionCache } from '../../../services/regions';
import { useRegionCascade } from '../../../hooks/useRegionCascade';
import { PremiumSelect } from '../../../ui';
import { SkeletonList } from './components/Skeleton';
import EmptyState from './components/EmptyState';
import RegionInput from './components/RegionInput';
import { useSuperAdminBack } from './useSuperAdminBack';
import { MenuButton } from '../shared/TierMenu';

type AdminRole = 'block_admin' | 'district_admin' | 'state_admin';
type RoleFilter = 'all' | 'staff' | AdminRole;

interface AdminRow {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: string;
  roleLabel: string;
  state: string;
  district: string;
  block: string;
  active: boolean;
  /** Other active admins covering this exact region — they share one queue. */
  coAdmins?: number;
  parentAdminId?: string;
}

/**
 * Region names the form offers.
 *
 * `states` / `districts` / `blocks` are already staffed — picking one joins that
 * region. `reference*` are names from the India reference that nobody staffs
 * yet — picking one creates the region.
 */
interface RegionSuggestions {
  states: string[];
  districts: string[];
  blocks: string[];
  referenceStates: string[];
  referenceDistricts: string[];
  referenceBlocks: string[];
}

const EMPTY_SUGGESTIONS: RegionSuggestions = {
  states: [], districts: [], blocks: [],
  referenceStates: [], referenceDistricts: [], referenceBlocks: [],
};

/** Region names the Super Admin added with "+" and has not saved yet. */
interface AddedRegions {
  state: string[];
  district: string[];
  block: string[];
}

const EMPTY_ADDED: AddedRegions = { state: [], district: [], block: [] };

/** What removing an admin would do to the applications they were holding. */
interface RemovalPreview {
  affected: number;
  escalatesToLabel: string;
  remainingAdmins: number;
  children: number;
}

// Ordered most-senior first, so the categorised list reads top-down the way the
// hierarchy actually works.
const TIERS: { key: AdminRole; label: string; plural: string; icon: string; color: string; light: string; chip: ConsoleChipKind; grad: string[] }[] = [
  { key: 'state_admin', label: 'State', plural: 'State Admins', icon: 'public', color: PALETTE.successText, light: PALETTE.successSoft, chip: 'approved', grad: CONSOLE_ACCENTS.green.grad },
  { key: 'district_admin', label: 'District', plural: 'District Admins', icon: 'map', color: PALETTE.warningText, light: PALETTE.warningSoft, chip: 'gold', grad: CONSOLE_ACCENTS.gold.grad },
  { key: 'block_admin', label: 'Block', plural: 'Block Admins', icon: 'location-city', color: PALETTE.indigo, light: PALETTE.indigoSoft, chip: 'info', grad: CONSOLE_ACCENTS.indigo.grad },
];

const ROLE_TABS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'state_admin', label: 'State' },
  { key: 'district_admin', label: 'District' },
  { key: 'block_admin', label: 'Block' },
  { key: 'staff', label: 'Staff' },
];

const EMPTY_FORM = {
  /**
   * Usually one of the three tiers. Widened to `string` because the roster
   * (website ManageAdmins) also lists accounts outside them — the events admin,
   * the super admin — and editing one must keep its role rather than silently
   * turning it into a block admin.
   */
  role: 'block_admin' as string,
  fullName: '',
  email: '',
  phoneNumber: '',
  password: '',
  confirmPassword: '',
  state: '',
  district: '',
  block: '',
  /** Edit only — sent as `active` when it changes (PUT accepts it). */
  active: true,
};

/** Which region fields each tier owns. Anything below its tier is not stored. */
const REGION_FIELDS: Record<AdminRole, ('state' | 'district' | 'block')[]> = {
  state_admin: ['state'],
  district_admin: ['state', 'district'],
  block_admin: ['state', 'district', 'block'],
};
/** A role outside the three tiers owns no region (website `needs` -> []). */
const regionFieldsFor = (role?: string): ('state' | 'district' | 'block')[] =>
  (REGION_FIELDS as Record<string, ('state' | 'district' | 'block')[]>)[String(role || '')] || [];
const isTierRole = (role?: string) => TIERS.some(t => t.key === role);

type FormState = typeof EMPTY_FORM;

/* ================================================== site staff accounts */

/** Roles maintained in the "Site staff accounts" section, not the tier list. */
const STAFF_ROLES = ['cms_admin', 'events_admin', 'attendance_admin'];
const isStaffRole = (role?: string) => STAFF_ROLES.includes(String(role || ''));

const MIN_PASSWORD = 8;

/** The same fields as the admin form above: name, email, phone, and a password left alone when blank. */
interface StaffDraft {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
}

/**
 * One CMS / events staff account, with its own inline editor
 * (PUT /admin/super/staff-accounts/:id). Inline card, never a native Modal
 * (Rule 2). Kept as simple as the tier-admin form: a blank password keeps the
 * current one.
 */
const StaffAccountCard = ({ item, index, onSaved }: { item: StaffAccount; index: number; onSaved: () => void }) => {
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<StaffDraft | null>(null);
  const [reveal, setReveal] = useState<{ [k: string]: boolean }>({});
  const [saving, setSaving] = useState(false);

  const inactive = item?.active === false;
  const lastLogin = item?.lastLoginAt ? shortDate(item.lastLoginAt) : '';

  const open = () => {
    setDraft({
      fullName: item?.fullName || '',
      email: item?.email || '',
      phoneNumber: item?.phoneNumber || '',
      password: '',
      confirmPassword: '',
    });
    setReveal({});
    setEditing(true);
  };
  const close = () => {
    setEditing(false);
    setDraft(null);
    setReveal({});
  };
  const patch = (next: Partial<StaffDraft>) => setDraft(prev => (prev ? { ...prev, ...next } : prev));

  const save = async () => {
    const d = draft;
    if (!d) return;
    if (!(d.fullName || '').trim()) { Alert.alert('Missing field', 'Full name is required.'); return; }
    if (!(d.email || '').trim()) { Alert.alert('Missing field', 'Email is required.'); return; }
    if (d.password && d.password.length < MIN_PASSWORD) {
      Alert.alert('Password too short', `Use at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (d.password && d.password !== d.confirmPassword) {
      Alert.alert('Password mismatch', 'The passwords you entered do not match.');
      return;
    }

    setSaving(true);
    try {
      // `active` is not sent: an absent field is left as it is.
      const payload: Record<string, any> = {
        fullName: (d.fullName || '').trim(),
        email: (d.email || '').trim().toLowerCase(),
        phoneNumber: (d.phoneNumber || '').trim(),
      };
      if (d.password) payload.password = d.password;
      const res = await updateStaffAccount(item?.id || '', payload);
      const changed: string[] = Array.isArray(res?.changed) ? res.changed : [];
      if (changed.length === 0) Alert.alert('Nothing changed', 'The account already had these details.');
      else Alert.alert('Saved', changed.includes('password') ? 'The new password works now.' : 'The account has been updated.');
      close();
      onSaved();
    } catch (err: any) {
      Alert.alert('Could not save', errorText(err, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const secureField = (key: 'password' | 'confirmPassword', label: string) => {
    if (!draft) return null;
    const shown = !!reveal[key];
    return (
      <PremiumInput
        tone="admin"
        label={label}
        icon="lock-outline"
        placeholder={key === 'password' ? 'Leave blank to keep' : 'Type it again'}
        value={draft[key]}
        onChangeText={(v: string) => patch({ [key]: v } as Partial<StaffDraft>)}
        secureTextEntry={!shown}
        autoCapitalize="none"
        autoCorrect={false}
        right={(
          <TouchableOpacity
            style={styles.revealBtn}
            onPress={() => setReveal(prev => ({ ...prev, [key]: !prev[key] }))}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={shown ? 'Hide password' : 'Show password'}
          >
            <Icon name={shown ? 'visibility-off' : 'visibility'} size={SIZE.icon} color={PALETTE.textFaint} />
          </TouchableOpacity>
        )}
      />
    );
  };

  return (
    <FadeInUp delay={Math.min(index, 6) * 40} style={styles.gutter}>
      <ConsoleCard style={[styles.adminCard, inactive && styles.adminInactive]} accent={inactive ? PALETTE.amber : undefined}>
        <View style={styles.adminHeader}>
          <GradientAvatar name={item?.fullName || item?.email} size={48} tone="admin" status={inactive ? 'pending' : 'online'} />
          <View style={styles.flexText}>
            <Text style={styles.adminName} numberOfLines={1}>{item?.fullName || 'Unnamed account'}</Text>
            <Text style={styles.adminEmail} numberOfLines={1}>{item?.email || 'No email'}</Text>
            <View style={styles.chipRow}>
              <ConsoleChip label={item?.roleLabel || item?.role || 'Staff'} kind="info" icon={item?.role === 'attendance_admin' ? 'qr-code-scanner' : item?.role === 'events_admin' ? 'event' : 'web'} />
              {inactive ? <ConsoleChip label="Deactivated" kind="warning" icon="pause-circle-outline" /> : null}
            </View>
          </View>
        </View>

        <View style={styles.adminMetaRow}>
          {item?.phoneNumber ? (
            <View style={styles.metaItem}>
              <View style={styles.metaIcon}><Icon name="phone" size={14} color={PALETTE.indigo} /></View>
              <Text style={styles.metaText} numberOfLines={1}>{item.phoneNumber}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <View style={styles.metaIcon}><Icon name="login" size={14} color={PALETTE.indigo} /></View>
            <Text style={styles.metaText} numberOfLines={1}>{lastLogin ? `Last signed in ${lastLogin}` : 'No sign-in recorded'}</Text>
          </View>
        </View>

        {!editing ? (
          <View style={styles.actions}>
            <ConsoleButton kind="soft" size="sm" icon="manage-accounts" label="Edit credentials" onPress={open} style={styles.flex} />
          </View>
        ) : null}

        {editing && draft ? (
          <View style={styles.staffEditor}>
            <PremiumInput
              tone="admin" label="Full Name" icon="person-outline" placeholder="Full name"
              value={draft.fullName} onChangeText={(v: string) => patch({ fullName: v })} autoCorrect={false}
            />
            <PremiumInput
              tone="admin" label="Email Address" icon="mail-outline" placeholder="name@activ.org.in"
              value={draft.email} onChangeText={(v: string) => patch({ email: v })}
              keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            />
            <PremiumInput
              tone="admin" label="Phone (optional)" icon="phone" placeholder="9876543210"
              value={draft.phoneNumber} onChangeText={(v: string) => patch({ phoneNumber: v })} keyboardType="phone-pad"
            />
            {secureField('password', 'New Password (leave blank to keep)')}
            {(draft.password || '').length > 0 ? secureField('confirmPassword', 'Confirm Password') : null}

            <View style={styles.actions}>
              <ConsoleButton kind="soft" size="sm" label="Cancel" onPress={close} style={styles.flex} disabled={saving} />
              <ConsoleButton size="sm" icon="check" label="Save" loading={saving} onPress={save} style={styles.flex} />
            </View>
          </View>
        ) : null}
      </ConsoleCard>
    </FadeInUp>
  );
};

const SEARCH_DEBOUNCE_MS = 350;

/**
 * Staff management: every admin on the platform, grouped by tier, with create,
 * edit and hard delete.
 */
const ManageAdminsScreen = ({ route }: any) => {
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const styles = useLegacyAppearance(legacyAppearance_styles);
  const CONSOLE_ACCENTS = useLegacyAppearance(legacyAppearance_CONSOLE_ACCENTS);
  const CONSOLE_LIST = useLegacyAppearance(legacyAppearance_CONSOLE_LIST);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  /** CMS / events staff, from their own endpoint (credentials maintained here). */
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [counts, setCounts] = useState<{ [key: string]: number }>({});
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const rosterSequence = useRef(0);
  const rosterAbort = useRef<AbortController | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [staffLoading, setStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState('');
  const regionFilter = useRegionCascade();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [mode, setMode] = useState<'idle' | 'create' | 'edit'>('idle');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Region name suggestions. Not constraints — every region field is free text.
  const [suggestions, setSuggestions] = useState<RegionSuggestions>(EMPTY_SUGGESTIONS);

  /**
   * Region names added with "+" on the open form, per level.
   *
   * They live only as long as the form does. Once the admin is saved the server
   * knows the region, and the next form gets it back in `suggestions.states` /
   * `.districts` / `.blocks` as a real, staffed region.
   */
  const [added, setAdded] = useState<AddedRegions>(EMPTY_ADDED);

  /** Which secure fields are currently unmasked, keyed by their label. */
  const [revealedFields, setRevealedFields] = useState<{ [label: string]: boolean }>({});

  /** The account's stored on/off, so `active` is only sent when the Super Admin changes it. */
  const [originalActive, setOriginalActive] = useState(true);

  // A name handed over from the Hub's search bar.
  const incomingQuery = route?.params?.q;
  useEffect(() => {
    if (typeof incomingQuery === 'string' && incomingQuery) setQuery(incomingQuery);
  }, [incomingQuery]);

  const listRef = useRef<SectionList>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setPage(1); setDebouncedQuery(query); }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const params = useMemo(
    () => {
      // Website ManageAdmins: `role` only when narrowed, `q` only from 2 chars
      // (the server ignores shorter ones anyway).
      const q = (debouncedQuery || '').trim();
      return {
        page, limit: 25, kind: 'regional',
        ...(roleFilter !== 'all' ? { role: roleFilter } : {}),
        ...(q.length >= 2 ? { q } : {}),
        ...(regionFilter.state ? { state: regionFilter.state } : {}),
        ...(regionFilter.district ? { district: regionFilter.district } : {}),
        ...(regionFilter.block ? { block: regionFilter.block } : {}),
      };
    },
    [roleFilter, debouncedQuery, regionFilter.state, regionFilter.district, regionFilter.block, page],
  );

  const fetchAdmins = useCallback(async (isRefresh = false) => {
    const sequence = ++rosterSequence.current;
    rosterAbort.current?.abort();
    const controller = new AbortController();
    rosterAbort.current = controller;
    if (roleFilter === 'staff') { setAdmins([]); setLoading(false); setRefreshing(false); setError(''); return; }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get('/admin/super/admins', { params, signal: controller.signal });
      if (sequence !== rosterSequence.current) return;
      const payload = response.data?.data || response.data || {};
      setAdmins(payload.admins || []);
      setCounts(payload.counts || {});
      setTotal(payload.total || 0);
      setPages(payload.pagination?.pages || 1);
      if (payload.pagination?.page && payload.pagination.page !== page) setPage(payload.pagination.page);
      setError('');
    } catch (err: any) {
      if (sequence !== rosterSequence.current || controller.signal.aborted) return;
      setError(err?.response?.data?.message || 'Could not load admins');
      setAdmins([]);
    } finally {
      if (sequence === rosterSequence.current) { setLoading(false); setRefreshing(false); }
    }
  }, [params, roleFilter, page]);

  const fetchStaff = useCallback(async () => {
    setStaffLoading(true);
    try {
      const rows = await listStaffAccounts();
      setStaff(Array.isArray(rows) ? rows : []);
      setStaffError('');
    } catch {
      setStaffError('Could not load staff accounts. Pull down to try again.');
    } finally { setStaffLoading(false); }
  }, []);

  // Same reason as the Hub: bottom tabs stay mounted, so without this the list
  // and its per-tier counts are whatever they were when the tab was first
  // opened. Deleting an admin from another screen would leave a ghost row here.
  useFocusEffect(
    useCallback(() => {
      fetchAdmins();
      return () => { rosterAbort.current?.abort(); };
    }, [fetchAdmins]),
  );

  useFocusEffect(useCallback(() => { fetchStaff(); }, [fetchStaff]));

  /**
   * Load the suggestion lists, re-scoped whenever the parent region changes.
   *
   * Debounced because the state and district fields are free text: without it
   * every keystroke in "Tamil Nadu" fires a request. The lists are only
   * suggestions, so being a moment behind the input costs nothing.
   */
  useEffect(() => {
    if (mode === 'idle') {
      setSuggestions(EMPTY_SUGGESTIONS);
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      api.get('/admin/super/admins/regions', {
        params: { state: form.state || '', district: form.district || '' },
      })
        .then(response => {
          if (cancelled) return;
          const payload = response.data?.data || response.data || {};
          setSuggestions({ ...EMPTY_SUGGESTIONS, ...payload });
        })
        .catch(() => {
          // Suggestions are a convenience. Losing them must not block a save,
          // because the fields work perfectly well as plain text.
          if (!cancelled) setSuggestions(EMPTY_SUGGESTIONS);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [mode, form.state, form.district]);

  // Categorised by tier. Empty tiers are dropped so the list never shows a
  // heading with nothing beneath it.
  // The CMS and events accounts get their own "Site staff accounts" section,
  // read from /admin/super/staff-accounts, with the credential editor the tier
  // form cannot offer (the tier edit refuses any non-tier role). Shown on
  // "All" only, narrowed by the search box. Super admin rows are not listed:
  // their password is changed in Settings.
  const staffShown = useMemo(() => {
    const q = (debouncedQuery || '').trim().toLowerCase();
    return (staff || []).filter(a => q.length < 2 ||
      `${a?.fullName || ''} ${a?.email || ''} ${a?.roleLabel || ''}`.toLowerCase().includes(q));
  }, [staff, debouncedQuery]);

  const sections = useMemo(() => [
    ...TIERS.map(tier => ({
      key: tier.key as string,
      title: tier.plural,
      icon: tier.icon,
      color: tier.color,
      light: tier.light,
      data: roleFilter === 'staff' ? [] : (admins || []).filter(a => a?.role === tier.key),
    })),
    {
      key: 'staff',
      title: 'Site staff accounts',
      icon: 'manage-accounts',
      color: PALETTE.indigo,
      light: PALETTE.indigoSoft,
      data: (roleFilter === 'all' || roleFilter === 'staff') ? staffShown as any[] : [],
    },
  ].filter(section => section.data.length > 0),
  [admins, staffShown, roleFilter]);

  const setField = (key: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  /**
   * Changing the tier drops the region fields the new tier does not own.
   *
   * State and district are kept when the new tier still uses them — moving a
   * block admin up to district admin should not make the super admin retype the
   * state they already entered. Only the now-meaningless fields are cleared, so
   * nothing is silently stored that the tier has no use for.
   */
  const setRole = (role: AdminRole) =>
    setForm(prev => {
      const owned = regionFieldsFor(role);
      return {
        ...prev,
        role,
        state: owned.includes('state') ? prev.state : '',
        district: owned.includes('district') ? prev.district : '',
        block: owned.includes('block') ? prev.block : '',
      };
    });

  /**
   * Renaming a parent region clears its children.
   *
   * Moving from "Ariyalur" to "Kollam" leaves the previously selected district
   * belonging to a state it is not in. Clearing is the honest response; silently
   * keeping it would create a district under the wrong state.
   */
  const setRegionField = (field: 'state' | 'district' | 'block', value: string) => {
    setForm(prev => {
      if (field === 'state') return { ...prev, state: value, district: '', block: '' };
      if (field === 'district') return { ...prev, district: value, block: '' };
      return { ...prev, block: value };
    });

    // Names added below the level that just changed belonged to the old parent.
    // A block typed under Ariyalur must not still be offered once the district
    // is something else — it would attach a real admin to the wrong region.
    if (field === 'state') setAdded(prev => ({ ...prev, district: [], block: [] }));
    if (field === 'district') setAdded(prev => ({ ...prev, block: [] }));
  };

  /**
   * Add a name to a dropdown without leaving the form.
   *
   * The India reference is thorough but not complete, and a region can be new
   * outright. Rather than making the Super Admin trust that free text survives
   * the save, "+" puts the name in the list straight away: it is visibly an
   * option, and the second admin for that region picks it instead of retyping
   * it. Nothing is written to the server here — the account's save is what
   * creates the region for real.
   */
  const addRegionOption = (field: 'state' | 'district' | 'block', name: string) => {
    const value = String(name || '').trim();
    if (!value) return;
    setAdded(prev => {
      const current = prev[field] || [];
      const exists = current.some(item => String(item || '').toLowerCase() === value.toLowerCase());
      return exists ? prev : { ...prev, [field]: [...current, value] };
    });
  };

  /**
   * Undo a "+", removing the name from the dropdown again.
   *
   * Only names added on this form can be removed this way, and nothing has been
   * written yet, so this deletes nothing real — it takes a typo back out of the
   * list before it becomes an account. If the removed name was the one selected,
   * the field is cleared through `setRegionField` so the levels below it go too;
   * leaving a block selected under a district that was just withdrawn would
   * geofence the new admin to a region the form no longer shows.
   */
  const removeRegionOption = (field: 'state' | 'district' | 'block', name: string) => {
    const value = String(name || '').trim();
    if (!value) return;

    setAdded(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter(
        item => String(item || '').toLowerCase() !== value.toLowerCase(),
      ),
    }));

    if (String(form[field] || '').trim().toLowerCase() === value.toLowerCase()) {
      setRegionField(field, '');
    }
  };

  const toggleActive = (next: boolean) => {
    if (next) { setForm(prev => ({ ...prev, active: true })); return; }
    Alert.alert(
      'Deactivate this admin?',
      'They will not be able to sign in, and any pending applications that only they cover escalate to the tier above until the account is reactivated. Saved when you tap Save changes.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deactivate', style: 'destructive', onPress: () => setForm(prev => ({ ...prev, active: false })) },
      ],
    );
  };

  const closeForm = () => {
    setMode('idle');
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAdded(EMPTY_ADDED);
    setRevealedFields({});
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, role: roleFilter !== 'all' ? roleFilter : 'block_admin' });
    setAdded(EMPTY_ADDED);
    setRevealedFields({});
    setMode('create');
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
  };

  const openEdit = (admin: AdminRow) => {
    setEditingId(admin?.id || null);
    setForm({
      role: String(admin?.role || 'block_admin'),
      fullName: admin?.fullName || '',
      email: admin?.email || '',
      phoneNumber: admin?.phoneNumber || '',
      password: '',
      confirmPassword: '',
      state: admin?.state || '',
      district: admin?.district || '',
      block: admin?.block || '',
      active: admin?.active !== false,
    });
    setOriginalActive(admin?.active !== false);
    setAdded(EMPTY_ADDED);
    setRevealedFields({});
    setMode('edit');
    listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true });
  };

  const handleSave = async () => {
    /*
     * Only the region keys this tier OWNS are sent (website ManageAdmins
     * `needs`): a state admin carries `state`, a district admin state +
     * district, a block admin all three. Sending `district: ''` for a state
     * admin would put an empty string into the region tree.
     */
    const needs = regionFieldsFor(form.role);
    const payload: Record<string, any> = {
      fullName: (form.fullName || '').trim(),
      email: (form.email || '').trim().toLowerCase(),
      phoneNumber: (form.phoneNumber || '').trim(),
      role: form.role,
    };
    needs.forEach((k) => { payload[k] = String((form as any)?.[k] || '').trim(); });
    if (form.password) payload.password = form.password;
    if (mode === 'edit' && isTierRole(form.role) && form.active !== originalActive) payload.active = !!form.active;

    // Checked here as well as on the server so the problem shows immediately.
    if (!payload.fullName) return Alert.alert('Missing field', 'Full name is required.');
    if (!payload.email) return Alert.alert('Missing field', 'Email is required.');
    if (mode === 'create' && (form.password || '').length < 8) {
      return Alert.alert('Weak password', 'Use at least 8 characters.');
    }
    if (form.password && form.password.length < 8) {
      return Alert.alert('Weak password', 'Use at least 8 characters.');
    }
    if (form.password && form.password !== form.confirmPassword) {
      return Alert.alert('Password mismatch', 'The passwords you entered do not match.');
    }

    if (needs.includes('state') && !payload.state) return Alert.alert('Missing field', 'State is required.');
    if (needs.includes('district') && !payload.district) {
      return Alert.alert('Missing field', 'District is required for this tier.');
    }
    if (needs.includes('block') && !payload.block) {
      return Alert.alert('Missing field', 'Block is required for a block admin.');
    }

    setSaving(true);
    try {
      if (mode === 'edit' && editingId) {
        await api.put(`/admin/super/admins/${encodeURIComponent(editingId)}`, payload);
        Alert.alert('Admin updated', `${payload.fullName}'s account has been saved.`);
      } else {
        const response = await api.post('/admin/super/admins', payload);
        const created = response.data?.data || response.data || {};
        const shared = Number(created?.coAdmins || 0);
        const opened: string[] = created?.regionsCreated || [];

        Alert.alert(
          'Admin created',
          [
            `${payload.fullName} can now sign in with that email.`,
            // The remote-control payoff: say plainly when this save just made a
            // new region selectable for applicants.
            opened.length > 0
              ? `The new ${opened.join(' / ')} is now selectable on the applicant registration form.`
              : '',
            // Load balancing: several admins on one region share a single queue.
            // Saying so up front stops two people quietly reviewing the same file.
            shared > 0
              ? `They share this region's queue with ${shared} other admin${shared === 1 ? '' : 's'}.`
              : '',
          ].filter(Boolean).join('\n\n'),
        );
      }

      // A new or moved admin changes which regions applicants may register into.
      invalidateRegionCache();
      closeForm();
      fetchAdmins(true);
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Delete, with the consequences shown first.
   *
   * The preview is fetched before the confirmation so the super admin is told
   * how many pending applications are about to change hands and which tier
   * inherits them. Those applications are never lost — orphan fallback routing
   * hands them to the tier above automatically, and hands them back if a
   * replacement is created — but "50 files move to the District tier" is not
   * something anyone should have to infer.
   */
  const handleDelete = async (admin: AdminRow) => {
    setBusyId(admin?.id || '');

    let preview: RemovalPreview | null = null;
    try {
      const response = await api.get(`/admin/super/admins/${encodeURIComponent(admin?.id || '')}/removal-preview`);
      preview = (response.data?.data || response.data || null) as RemovalPreview;
    } catch {
      // A failed preview must not block the delete; it only makes the warning
      // less specific.
      preview = null;
    } finally {
      setBusyId(null);
    }

    const consequences: string[] = [];
    if (preview) {
      if (preview.remainingAdmins > 0) {
        consequences.push(
          `${preview.remainingAdmins} other admin${preview.remainingAdmins === 1 ? '' : 's'} still ` +
          'cover this region, so its queue is unaffected.',
        );
      } else if (preview.affected > 0) {
        consequences.push(
          `${preview.affected} pending application${preview.affected === 1 ? '' : 's'} will escalate ` +
          `to the ${preview.escalatesToLabel} tier until a replacement is created.`,
        );
      } else {
        consequences.push('No region will be left unstaffed, and no pending application is affected.');
      }

      if (preview.children > 0) {
        consequences.push(
          `${preview.children} admin${preview.children === 1 ? '' : 's'} beneath them will be left ` +
          'without a parent at this tier.',
        );
      }
    }

    Alert.alert(
      'Delete permanently',
      `${admin?.fullName || admin?.email} will be erased from the database and can no longer sign in. ` +
      'This cannot be undone.' +
      (consequences.length > 0 ? `\n\n${consequences.join('\n\n')}` : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyId(admin?.id || '');
            try {
              await api.delete(`/admin/super/admins/${encodeURIComponent(admin?.id || '')}`);
              setAdmins(prev => (prev || []).filter(row => row.id !== admin?.id));
              invalidateRegionCache();
            } catch (err: any) {
              Alert.alert('Could not delete', err?.response?.data?.message || 'Please try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  /** An open form is what back closes first; only then does it leave the tab. */
  // Hardware back: closes an open form, else returns to the Hub.
  useSuperAdminBack(
    useCallback(() => {
      if (mode !== 'idle') {
        closeForm();
        return true;
      }
      return false;
    }, [mode]),
  );

  const keyExtractor = useCallback(
    (item: AdminRow, index: number) => String(item?.id || item?.email || index),
    [],
  );

  const renderItem = useCallback(({ item, index, section }: { item: AdminRow; index: number; section?: any }) => {
    if (section?.key === 'staff' || isStaffRole(item?.role)) {
      return <StaffAccountCard item={item as any} index={index} onSaved={fetchStaff} />;
    }
    const busy = busyId === item?.id;
    const place = [item?.block, item?.district, item?.state].filter(Boolean).join(', ');
    const meta = TIERS.find(t => t.key === item?.role);
    const inactive = item?.active === false;
    const lastLogin = (item as any)?.lastLoginAt ? shortDate((item as any).lastLoginAt) : '';

    return (
      <FadeInUp delay={Math.min(index, 6) * 40} style={styles.gutter}>
        <ConsoleCard style={[styles.adminCard, inactive && styles.adminInactive]} accent={inactive ? PALETTE.amber : undefined}>
          <View style={styles.adminHeader}>
            <GradientAvatar name={item?.fullName || item?.email} size={48} tone="admin" status={inactive ? 'pending' : 'online'} />
            <View style={styles.flexText}>
              <Text style={styles.adminName} numberOfLines={1}>{item?.fullName || 'Unnamed admin'}</Text>
              <Text style={styles.adminEmail} numberOfLines={1}>{item?.email || 'No email'}</Text>
              <View style={styles.chipRow}>
                <ConsoleChip label={item?.roleLabel || item?.role || 'Admin'} kind={meta?.chip || 'neutral'} icon={meta?.icon || 'manage-accounts'} />
                {inactive ? <ConsoleChip label="Deactivated" kind="warning" icon="pause-circle-outline" /> : null}
              </View>
            </View>
          </View>

          <View style={styles.adminMetaRow}>
            {place ? (
              <View style={styles.metaItem}>
                <View style={styles.metaIcon}><Icon name="location-on" size={14} color={PALETTE.indigo} /></View>
                <Text style={styles.metaText} numberOfLines={2}>{place}</Text>
              </View>
            ) : null}
            {item?.phoneNumber ? (
              <View style={styles.metaItem}>
                <View style={styles.metaIcon}><Icon name="phone" size={14} color={PALETTE.indigo} /></View>
                <Text style={styles.metaText} numberOfLines={1}>{item.phoneNumber}</Text>
              </View>
            ) : null}
            {/* Several admins on one region share a single queue. Showing it here
                is what turns an invisible duplication risk into a known team. */}
            {Number(item?.coAdmins || 0) > 0 ? (
              <View style={styles.metaItem}>
                <View style={[styles.metaIcon, { backgroundColor: PALETTE.successSoft }]}><Icon name="groups" size={14} color={PALETTE.successText} /></View>
                <Text style={[styles.metaText, styles.metaTextShared]} numberOfLines={2}>
                  Shared queue with {item.coAdmins} other admin{item.coAdmins === 1 ? '' : 's'}
                </Text>
              </View>
            ) : isTierRole(item?.role) ? (
              <View style={styles.metaItem}>
                <View style={styles.metaIcon}><Icon name="person" size={14} color={PALETTE.indigo} /></View>
                <Text style={styles.metaText} numberOfLines={1}>Sole owner of this region's queue</Text>
              </View>
            ) : null}
            {lastLogin ? (
              <View style={styles.metaItem}>
                <View style={styles.metaIcon}><Icon name="login" size={14} color={PALETTE.indigo} /></View>
                <Text style={styles.metaText} numberOfLines={1}>Last signed in {lastLogin}</Text>
              </View>
            ) : null}
            {inactive ? (
              <View style={styles.metaItem}>
                <View style={[styles.metaIcon, { backgroundColor: PALETTE.warningSoft }]}><Icon name="pause-circle-outline" size={14} color={PALETTE.warningText} /></View>
                <Text style={[styles.metaText, styles.metaTextInactive]} numberOfLines={2}>
                  Deactivated — their region's queue has escalated
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actions}>
            <ConsoleButton kind="soft" size="sm" icon="edit" label="Edit" onPress={() => openEdit(item)} style={styles.flex} />
            <ConsoleButton kind="danger" size="sm" icon="delete-outline" label="Delete" loading={busy} onPress={() => handleDelete(item)} style={styles.flex} />
          </View>
        </ConsoleCard>
      </FadeInUp>
    );
  }, [busyId, fetchStaff]);

  const renderSectionHeader = useCallback(({ section }: any) => {
    const meta = TIERS.find(t => t.key === section?.key);
    const isStaff = section?.key === 'staff';
    return (
      <View>
        <View style={styles.sectionHeader}>
          <LinearGradient
            colors={meta?.grad || (isStaff ? CONSOLE_ACCENTS.indigo.grad : CONSOLE_ACCENTS.slate.grad)}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sectionIcon}
          >
            <Icon name={section?.icon} size={15} color={PALETTE.white} />
          </LinearGradient>
          <Text style={styles.sectionTitle} numberOfLines={1}>{section?.title}</Text>
          <ConsoleChip label={String((section?.data || []).length)} kind="info" dot={false} />
        </View>
        {isStaff ? (
          <ConsoleNote
            icon="vpn-key"
            style={styles.staffNote}
            text="The CMS and events sign-ins. You keep their credentials — reset a password here and nobody else is needed. Your own password is changed in Settings."
          />
        ) : null}
      </View>
    );
  }, []);

  /**
   * A secure field is rendered with a reveal toggle.
   *
   * The Super Admin is typing a password *for somebody else* and then has to
   * pass it on, so being unable to check what was typed is worse than the usual
   * shoulder-surfing trade-off. It starts masked and is per-field, so opening
   * one does not unmask another.
   */
  const renderInput = (
    label: string,
    value: string,
    onChange: (text: string) => void,
    placeholder: string,
    options: { secure?: boolean; keyboard?: any; capitalize?: any; icon?: string } = {},
  ) => {
    const revealed = !!options.secure && !!revealedFields[label];

    return (
      <PremiumInput
        tone="admin"
        label={label}
        icon={options.icon}
        placeholder={placeholder}
        value={value}
        onChangeText={onChange}
        secureTextEntry={!!options.secure && !revealed}
        keyboardType={options.keyboard || 'default'}
        autoCapitalize={options.capitalize || 'words'}
        autoCorrect={false}
        right={options.secure ? (
          <TouchableOpacity
            style={styles.revealBtn}
            onPress={() => setRevealedFields(prev => ({ ...prev, [label]: !prev[label] }))}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          >
            <Icon
              name={revealed ? 'visibility-off' : 'visibility'}
              size={SIZE.icon}
              color={PALETTE.textFaint}
            />
          </TouchableOpacity>
        ) : undefined}
      />
    );
  };

  /**
   * The create / edit form.
   *
   * Every field is editable, region included, on create and on edit alike. The
   * Super Admin types region names directly: an unrecognised name is not an
   * error, it is a new region, and saving makes it selectable on the applicant
   * registration form.
   *
   * Only the region fields the chosen tier owns are shown — a state admin has no
   * district — so nothing is stored that the tier has no use for. Cancel / Save
   * live in the sticky footer while the form is open.
   */
  const renderForm = () => {
    const owned = regionFieldsFor(form.role);
    const outsideTiers = !isTierRole(form.role);

    return (
      <FadeInUp style={styles.gutter}>
        <ConsoleCard style={styles.formCard}>
          <View style={styles.formHead}>
            <LinearGradient colors={CONSOLE_ACCENTS.indigo.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.formIcon}>
              <Icon name={mode === 'edit' ? 'edit' : 'person-add'} size={SIZE.icon} color={PALETTE.white} />
            </LinearGradient>
            <View style={styles.flexText}>
              <Text style={styles.formTitle}>{mode === 'edit' ? 'Edit admin' : 'New admin'}</Text>
              <Text style={styles.formSub}>{mode === 'edit' ? 'Change the tier, region or account' : 'Pick a tier, then the region it governs'}</Text>
            </View>
          </View>

          <Text style={styles.groupLabel}>Tier</Text>
          <ConsoleTabs
            value={(isTierRole(form.role) ? form.role : '') as string}
            onChange={(v) => setRole(v as AdminRole)}
            options={TIERS.map(option => ({ value: option.key as string, label: option.label }))}
            style={styles.flushTabs}
          />

          {outsideTiers ? (
            <Text style={styles.tierNote}>
              Current role: <Text style={styles.mono}>{form.role}</Text> — it owns no region and keeps its role
              unless you pick a tier above.
            </Text>
          ) : (
            <Text style={styles.tierNote}>
              Saved into the <Text style={styles.mono}>{String(form.role || '').replace('_admin', '')}admins</Text> collection.
            </Text>
          )}

          {owned.length > 0 ? <Text style={styles.groupLabel}>Region</Text> : null}

          {owned.includes('state') ? (
            <RegionInput
              label="State"
              value={form.state}
              onChange={value => setRegionField('state', value)}
              inUse={suggestions.states}
              suggested={suggestions.referenceStates}
              extra={added.state}
              onAdd={name => addRegionOption('state', name)}
              onRemove={name => removeRegionOption('state', name)}
              scopeLabel="in India"
              placeholder="Type or pick a state"
            />
          ) : null}

          {owned.includes('district') ? (
            <RegionInput
              label="District"
              value={form.district}
              onChange={value => setRegionField('district', value)}
              inUse={suggestions.districts}
              suggested={suggestions.referenceDistricts}
              extra={added.district}
              onAdd={name => addRegionOption('district', name)}
              onRemove={name => removeRegionOption('district', name)}
              scopeLabel={form.state ? `in ${form.state}` : ''}
              placeholder={form.state ? `A district in ${form.state}` : 'Pick the state first'}
              disabled={!form.state}
            />
          ) : null}

          {owned.includes('block') ? (
            <RegionInput
              label="Block"
              value={form.block}
              onChange={value => setRegionField('block', value)}
              inUse={suggestions.blocks}
              suggested={suggestions.referenceBlocks}
              extra={added.block}
              onAdd={name => addRegionOption('block', name)}
              onRemove={name => removeRegionOption('block', name)}
              scopeLabel={form.district ? `in ${form.district}` : ''}
              placeholder={form.district ? `A block in ${form.district}` : 'Pick the district first'}
              disabled={!form.district}
            />
          ) : null}

          <View style={styles.rule} />
          <Text style={styles.groupLabel}>Account</Text>

          {renderInput('Full Name', form.fullName, v => setField('fullName', v), 'Jane Doe', { icon: 'person-outline' })}
          {renderInput('Email Address', form.email, v => setField('email', v), 'name@activ.com', {
            keyboard: 'email-address', capitalize: 'none', icon: 'mail-outline',
          })}
          {renderInput('Phone (optional)', form.phoneNumber, v => setField('phoneNumber', v), '9876543210', {
            keyboard: 'phone-pad', icon: 'phone',
          })}
          {renderInput(
            mode === 'edit' ? 'New Password (leave blank to keep)' : 'Password',
            form.password,
            v => setField('password', v),
            'At least 8 characters',
            { secure: true, capitalize: 'none', icon: 'lock-outline' },
          )}

          {(mode === 'create' || form.password.length > 0) ? renderInput(
            'Confirm Password',
            form.confirmPassword,
            v => setField('confirmPassword', v),
            'Type the password again',
            { secure: true, capitalize: 'none', icon: 'lock-outline' },
          ) : null}

          {/* Account on/off — `PUT /admin/super/admins/:id { active }`, sent only
              when it changes. The server records it (reactivated / deactivated)
              and escalates a deactivated admin's queue to the tier above. */}
          {mode === 'edit' && isTierRole(form.role) ? (
            <View style={[styles.activeRow, !form.active && styles.activeRowOff]}>
              <Icon name={form.active ? 'toggle-on' : 'pause-circle-outline'} size={22} color={form.active ? PALETTE.successText : PALETTE.warningText} />
              <View style={styles.flexText}>
                <Text style={styles.activeTitle}>{form.active ? 'Account active' : 'Account deactivated'}</Text>
                <Text style={styles.activeHint}>
                  {form.active
                    ? 'They can sign in and act on their region\'s queue.'
                    : 'They cannot sign in; their region\'s pending applications escalate to the tier above until reactivated.'}
                </Text>
              </View>
              <Switch
                value={!!form.active}
                onValueChange={toggleActive}
                disabled={saving}
                trackColor={{ false: PALETTE.borderStrong, true: PALETTE.indigo }}
                thumbColor={Platform.OS === 'android' ? PALETTE.white : undefined}
                ios_backgroundColor={PALETTE.borderStrong}
                accessibilityLabel="Account active"
              />
            </View>
          ) : null}

          <ConsoleNote
            icon="fence"
            style={styles.formNote}
            text="This region is the admin's geofence — they only ever see applications from it. It is also what applicants can choose: a region with no admin does not appear on the registration form, and a region you add here appears the moment you save."
          />
        </ConsoleCard>
      </FadeInUp>
    );
  };

  const listEmpty = () => {
    if (loading || (roleFilter === 'staff' && staffLoading)) return <View style={styles.gutter}><SkeletonList count={4} /></View>;
    if (error) {
      return <EmptyState tone="error" title={error} caption="Pull down to try again." action="Try again" onAction={() => fetchAdmins()} />;
    }
    return (
      <EmptyState
        title="No admins match"
        caption={(query || '').trim() || roleFilter !== 'all'
          ? 'Try a different filter.'
          : 'Add one to open a region for registration.'}
      />
    );
  };

  const footer = mode !== 'idle' ? (
    <BottomActionBar safeBottom={false}>
      <ConsoleButton kind="soft" label="Cancel" onPress={closeForm} style={styles.flex} />
      <ConsoleButton
        icon="check"
        label={mode === 'edit' ? 'Save changes' : 'Create admin'}
        loading={saving}
        onPress={handleSave}
        style={styles.flex}
      />
    </BottomActionBar>
  ) : undefined;

  const header = (
    <View>
      <ConsoleHeader
        left={<MenuButton />}
        topCenter="Super Admin"
        right={(
          <GlassIconButton
            icon={mode === 'idle' ? 'person-add' : 'close'}
            onPress={() => (mode === 'idle' ? openCreate() : closeForm())}
            accessibilityLabel={mode === 'idle' ? 'Add admin' : 'Close form'}
          />
        )}
        eyebrow={`${roleFilter === 'staff' ? staffShown.length : total} ${roleFilter === 'staff' ? 'staff' : 'regional'} accounts`}
        title="Admins"
        subtitle="A block admin opens a region for registration."
        art={<TeamKeys3D size={96} />}
        badges={[
          { icon: 'public', label: `${Number(counts.state_admin || 0)} state` },
          { icon: 'map', label: `${Number(counts.district_admin || 0)} district` },
          { icon: 'location-city', label: `${Number(counts.block_admin || 0)} block` },
        ]}
        waveHeight={62}
      />

      {mode === 'idle' ? (
        <FadeInUp style={styles.addWrap}>
          <ConsoleButton icon="person-add" label="Add an admin" onPress={openCreate} />
        </FadeInUp>
      ) : null}

      <ConsoleCard style={styles.filters}>
        <Text style={styles.filterTitle}>Find an admin</Text>
        <PremiumInput tone="admin" label="Search admins" icon="search" value={query} onChangeText={setQuery}
          placeholder="Name, email or region" autoCapitalize="none" autoCorrect={false}
          inputStyle={{ fontWeight: '700', color: PALETTE.text }} />
        <View style={styles.filterTabs} accessibilityRole="radiogroup">
          {ROLE_TABS.map(tab => {
            const selected = roleFilter === tab.key;
            const count = tab.key === 'staff' ? staff.length : tab.key === 'all' ? Number(counts.all || 0) + staff.length : counts[tab.key] || 0;
            return <TouchableOpacity key={tab.key} accessibilityRole="radio" accessibilityState={{ checked: selected }}
              accessibilityLabel={tab.label + ', ' + count} activeOpacity={0.85}
              onPress={() => { setPage(1); setRoleFilter(tab.key); }}
              style={[styles.filterTab, selected && styles.filterTabSelected]}>
              <Text style={[styles.filterTabLabel, selected && styles.filterTabTextSelected]}>{tab.label}</Text>
              <Text style={[styles.filterTabCount, selected && styles.filterTabTextSelected]}>{count}</Text>
            </TouchableOpacity>;
          })}
        </View>
        {roleFilter === 'staff' ? <ConsoleNote text="CMS, events and attendance accounts work across all regions." /> : <>
          <PremiumSelect strong icon="public" label="State" value={regionFilter.state} onChange={value => { setPage(1); regionFilter.setState(value); }} tone="admin" placeholder="All states and union territories" options={regionFilter.states.map(s => s.name)} />
          <PremiumSelect strong icon="map" label="District" value={regionFilter.district} onChange={value => { setPage(1); regionFilter.setDistrict(value); }} disabled={!regionFilter.state} tone="admin" placeholder="All districts" options={regionFilter.districts.map(d => d.name)} />
          <PremiumSelect strong icon="location-city" label="Block" value={regionFilter.block} onChange={value => { setPage(1); regionFilter.setBlock(value); }} disabled={!regionFilter.district} tone="admin" placeholder="All blocks" options={regionFilter.blocks.map(b => b.name)} />
          {regionFilter.state ? <ConsoleButton label="Clear region filters" onPress={() => { setPage(1); regionFilter.setState(''); }} /> : null}
          {regionFilter.error ? <ConsoleNote text={regionFilter.error} /> : null}
        </>}
        {error && roleFilter !== 'staff' ? <ConsoleNote text={error} /> : null}
        {staffError && (roleFilter === 'staff' || roleFilter === 'all') ? <ConsoleNote text={staffError} /> : null}
      </ConsoleCard>

      {/* Inline expandable form — never a native Modal inside a tab. */}
      {mode !== 'idle' ? renderForm() : null}
    </View>
  );

  return (
    <ConsoleFrame footer={footer} avoidKeyboard>
      <SectionList
        ref={listRef}
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={CONSOLE_LIST}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={10}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={roleFilter !== 'staff' && !error ? <View style={styles.pagination}>
          <Text style={styles.pageLabel}>{total} regional accounts · Page {page} of {pages}</Text>
          <View style={styles.paginationButtons}>
            <ConsoleButton kind="soft" label="Previous" disabled={loading || page <= 1} style={styles.flex}
              onPress={() => { setPage(value => value - 1); listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true }); }} />
            <ConsoleButton kind="soft" label="Next" disabled={loading || page >= pages} style={styles.flex}
              onPress={() => { setPage(value => value + 1); listRef.current?.getScrollResponder()?.scrollTo({ y: 0, animated: true }); }} />
          </View>
        </View> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { fetchAdmins(true); fetchStaff(); }} colors={[PALETTE.indigo]} tintColor={PALETTE.white} />}
      />
    </ConsoleFrame>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { marginHorizontal: SPACE.lg, borderWidth: 1.5, borderColor: '#ccd7f6', backgroundColor: '#f6f8ff', marginBottom: SPACE.md },
  filterTitle: { ...TYPE.heading, fontWeight: '800', color: PALETTE.indigoDark, marginBottom: SPACE.md },
  filterTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACE.lg },
  filterTab: { minWidth: 86, flexGrow: 1, borderWidth: 1.5, borderColor: '#ccd7f6', borderRadius: 12, padding: SPACE.sm, backgroundColor: PALETTE.white, alignItems: 'center', justifyContent: 'center', minHeight: 60 },
  filterTabSelected: { backgroundColor: PALETTE.indigo, borderColor: PALETTE.indigo },
  filterTabLabel: { ...TYPE.label, fontWeight: '800', color: PALETTE.indigoDark },
  filterTabCount: { ...TYPE.caption, fontWeight: '700', color: PALETTE.indigoDark },
  filterTabTextSelected: { color: PALETTE.white },
  pagination: { marginHorizontal: SPACE.lg, marginVertical: SPACE.lg },
  paginationButtons: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.sm },
  pageLabel: { ...TYPE.label, fontWeight: '700', textAlign: 'center' },
  flexText: { flex: 1, minWidth: 0 },
  gutter: { marginHorizontal: SPACE.lg },
  addWrap: { marginHorizontal: SPACE.lg, marginTop: -26, marginBottom: SPACE.md },
  search: { marginTop: SPACE.xs },
  roleTabs: { marginTop: SPACE.md, marginBottom: SPACE.sm },
  revealBtn: { paddingLeft: SPACE.sm, minHeight: SIZE.touch, justifyContent: 'center' },

  formCard: { marginTop: SPACE.md, marginBottom: SPACE.lg },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.lg },
  formIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  formTitle: { ...TYPE.title },
  formSub: { ...TYPE.caption, marginTop: 1 },
  groupLabel: { ...TYPE.eyebrow, color: PALETTE.indigoDark, marginBottom: SPACE.sm },
  flushTabs: { paddingHorizontal: 0 },
  tierNote: { ...TYPE.caption, fontSize: 11, lineHeight: 15, marginTop: SPACE.sm, marginBottom: SPACE.lg },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: PALETTE.textSoft },
  rule: { height: StyleSheet.hairlineWidth * 2, backgroundColor: PALETTE.divider, marginTop: SPACE.xs, marginBottom: SPACE.lg },
  formNote: { marginTop: SPACE.xs },
  activeRow: {
    flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md, marginBottom: SPACE.md,
    borderRadius: 16, backgroundColor: PALETTE.successSoft,
  },
  activeRowOff: { backgroundColor: PALETTE.warningSoft },
  activeTitle: { ...TYPE.bodyStrong },
  activeHint: { ...TYPE.caption, marginTop: 2 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.lg, marginBottom: SPACE.md, marginHorizontal: SPACE.lg },
  sectionIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, minWidth: 0, ...TYPE.heading, fontSize: 16 },

  adminCard: { marginBottom: SPACE.md },
  adminInactive: { opacity: 0.85 },
  adminHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  adminName: { ...TYPE.subheading, fontWeight: '800' },
  adminEmail: { ...TYPE.caption, marginTop: SPACE.xxs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACE.sm - 2 },

  adminMetaRow: {
    gap: SPACE.sm, marginTop: SPACE.md, paddingTop: SPACE.md,
    borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  metaIcon: { width: 26, height: 26, borderRadius: 9, backgroundColor: PALETTE.indigoSoft, alignItems: 'center', justifyContent: 'center' },
  metaText: { flex: 1, minWidth: 0, ...TYPE.label, fontWeight: '500', color: PALETTE.textMuted },
  metaTextShared: { color: PALETTE.successText, fontWeight: '600' },
  metaTextInactive: { color: PALETTE.warningText, fontWeight: '600' },

  actions: { flexDirection: 'row', gap: SPACE.sm, marginTop: SPACE.lg },

  staffNote: { marginHorizontal: SPACE.lg, marginTop: -SPACE.xs, marginBottom: SPACE.md },
  staffEditor: {
    marginTop: SPACE.lg, paddingTop: SPACE.lg,
    borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: PALETTE.divider,
  },
  pwBox: { borderRadius: 16, borderWidth: 1, borderColor: PALETTE.divider, padding: SPACE.md, marginBottom: SPACE.xs },
  pwHead: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  pwFields: { marginTop: SPACE.md },
  strengthRow: { flexDirection: 'row', gap: 4, marginTop: SPACE.xs },
  strengthBar: { flex: 1, height: 5, borderRadius: 3 },
  strengthText: { ...TYPE.caption, marginTop: SPACE.xs, marginBottom: SPACE.sm },
});

export default ManageAdminsScreen;

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_styles = styles;
const legacyAppearance_PALETTE = PALETTE;
const legacyAppearance_CONSOLE_ACCENTS = CONSOLE_ACCENTS;
const legacyAppearance_CONSOLE_LIST = CONSOLE_LIST;
