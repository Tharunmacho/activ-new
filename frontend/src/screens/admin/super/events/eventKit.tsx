import { useLegacyAppearance } from '../../../../ui/legacyAppearance';
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { PALETTE, RADIUS, SPACE, BRAND, PREMIUM_RADIUS } from '../../../../ui';
import type { CmsEventRow, EventDay, EventTarget } from '../../../../services/superApi';

/**
 * ============================================================================
 * SUPER ADMIN → EVENTS — the pieces of the event editor (module level only)
 * ============================================================================
 *
 * The phone counterparts of the website's CMS event controls:
 *
 *   DateField / TimeField   the date and AM/PM time inputs (inline pickers —
 *                           never a native <Modal>, per CLAUDE.md Rule 2)
 *   Choice                  an exactly-one-of radio group (CmsChoice)
 *   CheckCard               one on/off card (CmsCheck)
 *   InlineSelect            a select drawn as an inline expanding list
 *
 * and the date helpers `EventsManager` / `EventDaysEditor` use, ported 1:1 so
 * the phone stores exactly what the website stores.
 */

/* =================================================================== dates */

const pad = (n: number) => String(n).padStart(2, '0');
export const isDay = (v?: string | null) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
export const isTime = (v?: string | null) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));

/** A stored instant back into the date input, in LOCAL time. */
export const toDateInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const toTimeInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
/** The website's `toInstant`: local date + time → ISO, '' when no date. */
export const toInstant = (date: string, time: string): string => {
  if (!date) return '';
  const [h, m] = (time || '00:00').split(':').map(Number);
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d.toISOString();
};

export const datesBetween = (from: string, to: string): string[] => {
  if (!from) return [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to || from}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (end.getTime() < start.getTime()) return [];
  const out: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime() && out.length < 60) {
    out.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
};
export const addDays = (iso: string, delta: number): string => {
  const d = new Date(`${String(iso || '').slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export const dayDelta = (from: string, to: string): number => {
  const a = new Date(`${String(from || '').slice(0, 10)}T00:00:00`);
  const b = new Date(`${String(to || '').slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return NaN;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};
export const shiftDays = (days: EventDay[], delta: number): EventDay[] => {
  if (!delta || !Number.isFinite(delta)) return days || [];
  return (days || []).map((d) => ({ ...d, date: addDays(String(d?.date || ''), delta) }));
};
/** Only the days inside the range, and none at all for a one-day event. */
export const daysInRange = (days: EventDay[], startDate: string, endDate: string): EventDay[] => {
  const dates = datesBetween(startDate, endDate);
  if (dates.length < 2) return [];
  const wanted = new Set(dates);
  return (days || []).filter((d) => wanted.has(String(d?.date || '').slice(0, 10)));
};

export const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};

/** "10 Oct 2026, 09:00 AM" — the website's `listWhen`. */
export const listWhen = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const h = d.getHours();
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${d.getDate()} ${month} ${d.getFullYear()}, ${pad(h % 12 || 12)}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
};

/** "9:30 AM" for an "HH:MM" value. */
export const timeLabel = (v?: string | null) => {
  if (!isTime(v)) return '';
  const [h, m] = String(v).split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
};

/** An event with NO date has not been held; the END decides, else the start. */
export const hasBeenHeld = (e?: CmsEventRow | null) => {
  const when = e?.endAt || e?.startAt;
  if (!when) return false;
  const t = new Date(when).getTime();
  return !Number.isNaN(t) && t < Date.now();
};

/* ============================================================ visibility */

export const hasTargets = (e?: CmsEventRow | null) =>
  (Array.isArray(e?.targets) && (e?.targets || []).length > 0) || !!(e?.state || e?.district || e?.block);

/** The browser's copy of `onboardingVisibility.isOnboardingContent` (website isOnPublicSite). */
export const isOnPublicSite = (e?: CmsEventRow | null) =>
  e?.showOnOnboarding === true || ((e?.channel || 'public') === 'public' && !hasTargets(e));

export const targetText = (t: EventTarget) => [t?.state, t?.district, t?.block].filter(Boolean).join(' › ');
export const sameTarget = (a: EventTarget, b: EventTarget) =>
  a.state === b.state && a.district === b.district && a.block === b.block;
/** Does `outer` already reach everything `inner` does? (RegionTargetPicker `covers`) */
export const coversTarget = (outer: EventTarget, inner: EventTarget) => {
  if (outer.state !== inner.state) return false;
  if (!outer.district) return true;
  if (outer.district !== inner.district) return false;
  if (!outer.block) return true;
  return outer.block === inner.block;
};

/* ============================================================== controls */

export function Label({ text, hint }: { text: string; hint?: string }) {
  const k = useLegacyAppearance(legacyAppearance_k);
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={k.label}>{text}</Text>
      {hint ? <Text style={k.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Exactly one of N (CmsChoice): radio semantics, a drawn radio mark. */
export function Choice<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void;
  options: { value: T; icon: string; title: string; detail?: string }[];
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View accessibilityRole="radiogroup" style={{ gap: SPACE.sm }}>
      {(options || []).map((o) => {
        const on = o.value === value;
        return (
          <TouchableOpacity key={o.value} onPress={() => onChange(o.value)} activeOpacity={0.85}
            accessibilityRole="radio" accessibilityState={{ checked: on }} style={[k.choice, on && k.choiceOn]}>
            <View style={[k.choiceIcon, on && { backgroundColor: PALETTE.indigo }]}>
              <Icon name={o.icon} size={18} color={on ? '#FFFFFF' : PALETTE.indigo} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[k.choiceTitle, on && { color: PALETTE.indigo }]}>{o.title}</Text>
              {o.detail ? <Text style={k.choiceDetail}>{o.detail}</Text> : null}
            </View>
            <View style={[k.radio, on && k.radioOn]}>{on ? <View style={k.radioDot} /> : null}</View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** One card, on or off (CmsCheck). */
export function CheckCard({ checked, onChange, icon, title, detail }: {
  checked: boolean; onChange: (v: boolean) => void; icon: string; title: string; detail?: string;
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <TouchableOpacity onPress={() => onChange(!checked)} activeOpacity={0.85}
      accessibilityRole="checkbox" accessibilityState={{ checked }} style={[k.choice, checked && k.choiceOn]}>
      <View style={[k.choiceIcon, checked && { backgroundColor: PALETTE.indigo }]}>
        <Icon name={icon} size={18} color={checked ? '#FFFFFF' : PALETTE.indigo} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[k.choiceTitle, checked && { color: PALETTE.indigo }]}>{title}</Text>
        {detail ? <Text style={k.choiceDetail}>{detail}</Text> : null}
      </View>
      <View style={[k.box, checked && k.boxOn]}>{checked ? <Icon name="check" size={16} color="#FFFFFF" /> : null}</View>
    </TouchableOpacity>
  );
}

/** A select drawn as an inline expanding list (no native modal inside a tab). */
export function InlineSelect({ label, value, options, placeholder, onChange, disabled, note, emptyLabel }: {
  label?: string; value: string; options: string[]; placeholder: string; onChange: (v: string) => void;
  disabled?: boolean; note?: string; emptyLabel?: string;
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const term = (q || '').trim().toLowerCase();
    return (options || []).filter((o) => !term || String(o || '').toLowerCase().includes(term));
  }, [options, q]);
  return (
    <View style={{ marginBottom: SPACE.md }}>
      {label ? <Text style={k.label}>{label}</Text> : null}
      <TouchableOpacity disabled={disabled} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}
        style={[k.select, disabled && { opacity: 0.5 }, open && { borderColor: PALETTE.indigo, backgroundColor: PALETTE.card }]}>
        <Text style={[k.selectText, !value && { color: PALETTE.textFaint }]} numberOfLines={1}>{value || placeholder}</Text>
        <Icon name={open ? 'expand-less' : 'expand-more'} size={22} color={PALETTE.textMuted} />
      </TouchableOpacity>
      {note ? <Text style={k.hint}>{note}</Text> : null}
      {open && !disabled ? (
        <View style={k.panel}>
          {(options || []).length > 8 ? (
            <View style={k.search}>
              <Icon name="search" size={18} color={PALETTE.textFaint} />
              <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={PALETTE.textFaint}
                style={k.searchInput} autoCorrect={false} />
            </View>
          ) : null}
          <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={k.option} onPress={() => { onChange(''); setOpen(false); setQ(''); }}>
              <Text style={[k.optionText, { color: PALETTE.textMuted }]}>{emptyLabel || placeholder}</Text>
              {!value ? <Icon name="check" size={18} color={PALETTE.indigo} /> : null}
            </TouchableOpacity>
            {list.map((o) => (
              <TouchableOpacity key={o} style={k.option} onPress={() => { onChange(o); setOpen(false); setQ(''); }}>
                <Text style={[k.optionText, o === value && { color: PALETTE.indigo, fontWeight: '800' }]}>{o}</Text>
                {o === value ? <Icon name="check" size={18} color={PALETTE.indigo} /> : null}
              </TouchableOpacity>
            ))}
            {list.length === 0 ? <Text style={[k.hint, { padding: SPACE.md }]}>Nothing matches.</Text> : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** A date input: an inline month calendar, storing `YYYY-MM-DD` (blank allowed). */
export function DateField({ label, value, onChange, hint, min }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; min?: string;
}) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [open, setOpen] = useState(false);
  const base = isDay(value) ? new Date(`${value}T00:00:00`) : (isDay(min) ? new Date(`${min}T00:00:00`) : new Date());
  const [cursor, setCursor] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const count = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i += 1) out.push(null);
    for (let d = 1; d <= count; d += 1) out.push(`${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);
  const move = (delta: number) => setCursor((c) => {
    const d = new Date(c.y, c.m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const today = toDateInput(new Date().toISOString());
  const shown = isDay(value)
    ? new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  return (
    <View style={{ marginBottom: SPACE.md }}>
      <Text style={k.label}>{label}</Text>
      <TouchableOpacity onPress={() => {
        if (!open) {
          const at = isDay(value) ? new Date(`${value}T00:00:00`) : (isDay(min) ? new Date(`${min}T00:00:00`) : new Date());
          setCursor({ y: at.getFullYear(), m: at.getMonth() });
        }
        setOpen((v) => !v);
      }} activeOpacity={0.8} style={[k.select, open && { borderColor: PALETTE.indigo, backgroundColor: PALETTE.card }]}>
        <Icon name="event" size={19} color={PALETTE.textFaint} style={{ marginRight: 8 }} />
        <Text style={[k.selectText, !shown && { color: PALETTE.textFaint }]} numberOfLines={1}>{shown || 'No date yet'}</Text>
        {value ? (
          <TouchableOpacity onPress={() => { onChange(''); setOpen(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Clear ${label}`}>
            <Icon name="close" size={18} color={PALETTE.textMuted} />
          </TouchableOpacity>
        ) : <Icon name={open ? 'expand-less' : 'expand-more'} size={22} color={PALETTE.textMuted} />}
      </TouchableOpacity>
      {hint ? <Text style={k.hint}>{hint}</Text> : null}
      {open ? (
        <View style={k.panel}>
          <View style={k.calHead}>
            <TouchableOpacity onPress={() => move(-1)} style={k.calNav} accessibilityLabel="Previous month"><Icon name="chevron-left" size={22} color={PALETTE.text} /></TouchableOpacity>
            <Text style={k.calTitle}>{new Date(cursor.y, cursor.m, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity onPress={() => move(1)} style={k.calNav} accessibilityLabel="Next month"><Icon name="chevron-right" size={22} color={PALETTE.text} /></TouchableOpacity>
          </View>
          <View style={k.calGrid}>
            {WEEK.map((w, i) => <Text key={`w${i}`} style={k.calWeek}>{w}</Text>)}
            {cells.map((iso, i) => {
              if (!iso) return <View key={`e${i}`} style={k.calCell} />;
              const on = iso === value;
              const blocked = !!(min && isDay(min) && iso < min);
              return (
                <TouchableOpacity key={iso} disabled={blocked} onPress={() => { onChange(iso); setOpen(false); }}
                  style={[k.calCell, on && k.calOn, blocked && { opacity: 0.3 }]}>
                  <Text style={[k.calDay, iso === today && { color: PALETTE.indigo, fontWeight: '900' }, on && { color: '#FFFFFF' }]}>
                    {Number(iso.slice(8, 10))}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

/**
 * A time that always reads AM/PM (the website's TimeField) and stores "HH:MM".
 * Blank is allowed — nothing on the event form is required.
 */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  const [open, setOpen] = useState(false);
  const has = isTime(value);
  const [h24, m] = has ? String(value).split(':').map(Number) : [9, 0];
  const h12 = h24 % 12 || 12;
  const pm = h24 >= 12;
  const set = (hour12: number, minute: number, isPm: boolean) => {
    const hour = (hour12 % 12) + (isPm ? 12 : 0);
    onChange(`${pad(hour)}:${pad(minute)}`);
  };
  return (
    <View style={{ marginBottom: SPACE.md, flex: 1, minWidth: 0 }}>
      <Text style={k.label}>{label}</Text>
      <TouchableOpacity onPress={() => setOpen((v) => !v)} activeOpacity={0.8} style={[k.select, open && { borderColor: PALETTE.indigo, backgroundColor: PALETTE.card }]}>
        <Icon name="schedule" size={19} color={PALETTE.textFaint} style={{ marginRight: 8 }} />
        <Text style={[k.selectText, !has && { color: PALETTE.textFaint }]} numberOfLines={1}>{has ? timeLabel(value) : 'Not set'}</Text>
        {has ? (
          <TouchableOpacity onPress={() => { onChange(''); setOpen(false); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel={`Clear ${label}`}>
            <Icon name="close" size={18} color={PALETTE.textMuted} />
          </TouchableOpacity>
        ) : null}
      </TouchableOpacity>
      {open ? (
        <View style={[k.panel, { padding: SPACE.sm }]}>
          <View style={k.ampm}>
            {[false, true].map((isPm) => (
              <TouchableOpacity key={isPm ? 'pm' : 'am'} onPress={() => set(h12, m, isPm)}
                style={[k.ampmBtn, has && pm === isPm && k.chipOn]}>
                <Text style={[k.chipText, has && pm === isPm && { color: '#FFFFFF' }]}>{isPm ? 'PM' : 'AM'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={k.miniLabel}>Hour</Text>
          <View style={k.chipGrid}>
            {HOURS.map((h) => (
              <TouchableOpacity key={`h${h}`} onPress={() => set(h, m, pm)} style={[k.chip, has && h === h12 && k.chipOn]}>
                <Text style={[k.chipText, has && h === h12 && { color: '#FFFFFF' }]}>{h}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={k.miniLabel}>Minute</Text>
          <View style={k.chipGrid}>
            {MINUTES.map((mm) => (
              <TouchableOpacity key={`m${mm}`} onPress={() => set(h12, mm, pm)} style={[k.chip, has && mm === m && k.chipOn]}>
                <Text style={[k.chipText, has && mm === m && { color: '#FFFFFF' }]}>{pad(mm)}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => setOpen(false)} style={k.done}><Text style={k.doneText}>Done</Text></TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

/** A small section heading inside an editor card, with an optional action. */
export function SubHead({ title, hint, action, onAction }: { title: string; hint?: string; action?: string; onAction?: () => void }) {
  const k = useLegacyAppearance(legacyAppearance_k);
  const PALETTE = useLegacyAppearance(legacyAppearance_PALETTE);
  return (
    <View style={k.subHead}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={k.subTitle}>{title}</Text>
        {hint ? <Text style={k.hint}>{hint}</Text> : null}
      </View>
      {action && onAction ? (
        <TouchableOpacity onPress={onAction} style={k.addBtn} activeOpacity={0.8}>
          <Icon name="add" size={16} color={PALETTE.indigo} />
          <Text style={k.addText}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export const k = StyleSheet.create({
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: PALETTE.textSoft, marginLeft: 2 },
  hint: { fontSize: 12, color: PALETTE.textMuted, marginTop: 4, lineHeight: 17 },
  miniLabel: { fontSize: 11, fontWeight: '800', color: PALETTE.textFaint, letterSpacing: 0.6, marginTop: SPACE.sm, marginBottom: 6, textTransform: 'uppercase' },

  choice: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, padding: SPACE.md, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(226,232,240,0.9)', backgroundColor: PALETTE.card, shadowColor: BRAND.indigoDeep, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  choiceOn: { borderColor: PALETTE.indigo, backgroundColor: PALETTE.indigoSoft },
  choiceIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.indigoSoft },
  choiceTitle: { fontSize: 14, fontWeight: '800', color: PALETTE.text },
  choiceDetail: { fontSize: 12, color: PALETTE.textMuted, marginTop: 2, lineHeight: 17 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: PALETTE.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: PALETTE.indigo },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: PALETTE.indigo },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: PALETTE.borderStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: PALETTE.indigo, backgroundColor: PALETTE.indigo },

  select: { flexDirection: 'row', alignItems: 'center', minHeight: 52, borderRadius: PREMIUM_RADIUS.input, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: BRAND.inputFillAdmin, paddingHorizontal: SPACE.lg - 2, marginTop: SPACE.sm },
  selectText: { flex: 1, fontSize: 15, color: PALETTE.text },
  panel: { marginTop: 6, borderRadius: PREMIUM_RADIUS.input, borderWidth: 1, borderColor: 'rgba(84,64,212,0.16)', backgroundColor: PALETTE.card, overflow: 'hidden' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: SPACE.md, borderBottomWidth: 1, borderBottomColor: PALETTE.border },
  searchInput: { flex: 1, fontSize: 14, color: PALETTE.text, paddingVertical: 10 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACE.md, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: PALETTE.border },
  optionText: { flex: 1, fontSize: 14, color: PALETTE.text },

  calHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE.sm },
  calNav: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.field },
  calTitle: { fontSize: 15, fontWeight: '800', color: PALETTE.text },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: SPACE.xs, paddingBottom: SPACE.sm },
  calWeek: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '800', color: PALETTE.textFaint, paddingVertical: 6 },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  calOn: { backgroundColor: PALETTE.indigo },
  calDay: { fontSize: 14, fontWeight: '600', color: PALETTE.text },

  ampm: { flexDirection: 'row', gap: 8 },
  ampmBtn: { flex: 1, minHeight: 38, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: PALETTE.borderStrong, alignItems: 'center', justifyContent: 'center' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { width: 44, height: 38, borderRadius: 10, borderWidth: 1, borderColor: PALETTE.border, alignItems: 'center', justifyContent: 'center', backgroundColor: PALETTE.card },
  chipOn: { backgroundColor: PALETTE.indigo, borderColor: PALETTE.indigo },
  chipText: { fontSize: 13, fontWeight: '700', color: PALETTE.textSoft },
  done: { alignSelf: 'flex-end', marginTop: SPACE.sm, paddingHorizontal: SPACE.lg, paddingVertical: 8 },
  doneText: { fontSize: 14, fontWeight: '800', color: PALETTE.indigo },

  subHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, marginBottom: SPACE.md },
  subTitle: { fontSize: 15, fontWeight: '800', color: PALETTE.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderColor: PALETTE.indigo, backgroundColor: PALETTE.card, borderRadius: RADIUS.pill, paddingHorizontal: 12, minHeight: 36 },
  addText: { fontSize: 12, fontWeight: '800', color: PALETTE.indigo },
});

// Theme-aware aliases preserve the original styles for non-React helpers.
const legacyAppearance_k = k;
const legacyAppearance_PALETTE = PALETTE;
