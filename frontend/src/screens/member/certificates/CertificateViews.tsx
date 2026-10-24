import React, { useLayoutEffect, useId, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, LayoutChangeEvent, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
  TextPath,
} from 'react-native-svg';
import { asArray, RADIUS, SHADOW } from '../../../ui';
import { amountInWords as spellAmount } from '../../../utils/amountInWords';
import { A4_WIDTH, A4_HEIGHT, MEMBERSHIP_PAGE, MEMBERSHIP_SIGNATURE, membershipContentScale } from './certificateLayout';

/**
 * ============================================================================
 * THE TWO CERTIFICATES, DRAWN NATIVELY
 * ============================================================================
 *
 * Same data and same wording as the website's
 * `features/member/certificates/MembershipCertificate.tsx` and
 * `TaxExemptionCertificate.tsx` (which the server does not render — it sends
 * the fields; each client draws them), with the template's furniture in SVG.
 *
 *   membership   a fixed A4 landscape sheet, scaled to the available viewport.
 *   tax (80G)    a TRUE A4 page: laid out at the website's 794 x 1123 units
 *                with the website's paddings, type sizes and columns, then
 *                scaled uniformly — every phone shows the identical page, at
 *                exactly 1 : 1.4143. `CertificateZoomScreen` shows it larger.
 *
 *
 *   membership   heavy navy frame + gold rules, navy/gold/royal diagonal bands
 *                in all four corners, faint guilloche waves, the mark centred,
 *                the Founder President's signature ink, the struck medallion,
 *                the date of issue, a navy foot bar with the certificate no.
 *   tax (80G)    formal white letter, centered logo, navy/gold right corners,
 *                contribution paragraph, payment references and ACTIV address.
 *
 * NOTHING IS INVENTED: a fact the server did not send is left out, an amount
 * it did not record is a dash, and a null `validUntil` is never printed as a
 * date (null means lifetime).
 *
 * The tax certificate also draws the donor's 80G receipt and year statement
 * (website DonationDocumentPage feeds the same component), via `stamp`,
 * `receiptColumn` and `amountInWords`.
 */

export const ASSOCIATION_NAME = 'Adidravidar Confederation of Trade and Industrial Vision';
const ADDRESS = '6&7, Hayagreeva Apartment, 121, Velachery Main Road, Chennai - 600032';
const PHONE = '+91-82201-12188';
const EMAIL = 'info@activ.org.in';
const WEB = 'https://activ.org.in';

/*
 * The certificate's print palette — the website template's own values
 * (navy + gold on white paper, never purple). Fixed layout: the sheet is a
 * document, so its type sizes are its own and do not follow TYPE.
 */
const NAVY = '#0E1F4D';
const NAVY_MID = '#1C2E68';
const NAVY_SOFT = '#2A4A9A';
const INK = '#13224F';
const MUTED = '#5B6B8F';
const GOLD = '#C8992F';
const GOLD_LIGHT = '#E6C878';
const GOLD_PALE = '#F7E3A6';
const GOLD_DEEP = '#8A6518';
const PAPER = '#FBFCFF';
const LINE = '#E3EAF6';
const PANEL_LINE = '#CFDBF1';

const LOGO = require('../../../assets/images/activlogo.png');
const SIGNATURE = require('../../../assets/images/chairman-signature.png');

/** 28/09/2026 — the website's en-GB 2-digit date. */
export const certDate = (iso?: string | null, sep = '/') => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}${sep}${mm}${sep}${d.getFullYear()}`;
};

/** ₹ 1,000.00 — a dash when nothing was recorded. */
export const certRupees = (n?: number | null) =>
  typeof n === 'number' && Number.isFinite(n)
    ? `₹ ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';

/** "2026-27" → "2026–2027". */
export const fullYear = (fy?: string | null) => {
  const m = /^(\d{4})-(\d{2,4})$/.exec(String(fy || ''));
  return m ? `${m[1]}–${m[2].length === 2 ? `${m[1].slice(0, 2)}${m[2]}` : m[2]}` : String(fy || '');
};

/* ------------------------------------------------------------------ helpers */

/** An id safe for `url(#…)` — two medallions on one screen must not share one. */
const useSvgId = (prefix: string) => `${prefix}${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

const at = (cx: number, cy: number, r: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) };
};

/* ------------------------------------------------------------------ the medallion */

/**
 * The association's medallion, struck rather than stamped (website
 * CertificateMedallion): a bevelled gold rim, a royal band carrying the name
 * and the motto in gold, a cream face with a laurel wreath, three stars, the
 * mark extruded in gold, and a banner across the foot.
 */
export function Seal({ line, size = 96 }: { line: string; size?: number }) {
  const rim = useSvgId('mdRim');
  const bevel = useSvgId('mdBev');
  const royal = useSvgId('mdRoyal');
  const face = useSvgId('mdFace');
  const leafGold = useSvgId('mdLg');
  const leafRoyal = useSvgId('mdLr');
  const topArc = useSvgId('mdTop');
  const footArc = useSvgId('mdFoot');
  const sheen = useSvgId('mdSheen');

  const wreath = useMemo(() => {
    const leaves: { x: number; y: number; rot: number; gold: boolean }[] = [];
    const berries: { x: number; y: number }[] = [];
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 7; i += 1) {
        const deg = side < 0 ? 188 - i * 12 : -8 + i * 12;
        const p = at(130, 132, 76, deg);
        leaves.push({ x: p.x, y: p.y, rot: -(deg + 90), gold: i % 2 === 0 });
        if (i < 6) berries.push(at(130, 132, 62, deg + (side < 0 ? -6 : 6)));
      }
    });
    return { leaves, berries };
  }, []);

  const t1 = at(130, 130, 110, 200);
  const t2 = at(130, 130, 110, -20);
  const f1 = at(130, 130, 110, 215);
  const f2 = at(130, 130, 110, 325);
  const arc = (a: { x: number; y: number }, b: { x: number; y: number }, large: number, sweep: number) =>
    `M${a.x.toFixed(2)},${a.y.toFixed(2)} A110,110 0 ${large},${sweep} ${b.x.toFixed(2)},${b.y.toFixed(2)}`;
  const banner = String(line || '').toUpperCase();

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Seal of the association — ${line}`} style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 260 260">
        <Defs>
          <SvgLinearGradient id={rim} x1="0.12" y1="0" x2="0.88" y2="1">
            <Stop offset="0" stopColor={GOLD_PALE} />
            <Stop offset="0.28" stopColor={GOLD_LIGHT} />
            <Stop offset="0.55" stopColor={GOLD} />
            <Stop offset="1" stopColor={GOLD_DEEP} />
          </SvgLinearGradient>
          <SvgLinearGradient id={bevel} x1="0.9" y1="0" x2="0.1" y2="1">
            <Stop offset="0" stopColor={GOLD_DEEP} />
            <Stop offset="0.5" stopColor={GOLD} />
            <Stop offset="1" stopColor={GOLD_PALE} />
          </SvgLinearGradient>
          <SvgLinearGradient id={royal} x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor="#1D4ED8" />
            <Stop offset="0.5" stopColor="#1E3A8A" />
            <Stop offset="1" stopColor="#040B26" />
          </SvgLinearGradient>
          <RadialGradient id={face} cx="36%" cy="28%" r="82%">
            <Stop offset="0" stopColor="#FFFFFA" />
            <Stop offset="0.58" stopColor="#FCF7EA" />
            <Stop offset="1" stopColor="#E6DBBE" />
          </RadialGradient>
          <SvgLinearGradient id={leafGold} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={GOLD_PALE} />
            <Stop offset="1" stopColor={GOLD} />
          </SvgLinearGradient>
          <SvgLinearGradient id={leafRoyal} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#3B82F6" />
            <Stop offset="1" stopColor="#1E3A8A" />
          </SvgLinearGradient>
          <RadialGradient id={sheen} cx="30%" cy="24%" r="62%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.45} />
            <Stop offset="0.58" stopColor="#FFFFFF" stopOpacity={0.05} />
            <Stop offset="1" stopColor="#000000" stopOpacity={0.14} />
          </RadialGradient>
          <Path id={topArc} d={arc(t1, t2, 1, 1)} fill="none" />
          <Path id={footArc} d={arc(f1, f2, 0, 0)} fill="none" />
        </Defs>

        <Circle cx={133} cy={136} r={129} fill="#0A1738" fillOpacity={0.22} />
        <Circle cx={130} cy={130} r={129} fill={`url(#${rim})`} />
        <Circle cx={130} cy={130} r={122} fill={`url(#${bevel})`} />
        <Circle cx={130} cy={130} r={120} fill={`url(#${royal})`} />
        <Circle cx={130} cy={130} r={120} fill="none" stroke={GOLD_PALE} strokeWidth={1} />
        <Circle cx={130} cy={130} r={99} fill="none" stroke={`url(#${rim})`} strokeWidth={6} />
        <Circle cx={130} cy={130} r={95} fill={`url(#${face})`} />

        <SvgText fill={GOLD_PALE} fontSize={9.5} fontWeight="700" letterSpacing={0.5}>
          <TextPath href={`#${topArc}`} startOffset="50%" textAnchor="middle">
            ADIDRAVIDAR CONFEDERATION OF TRADE &amp; INDUSTRIAL VISION
          </TextPath>
        </SvgText>
        <SvgText fill={GOLD_PALE} fontSize={8.5} fontWeight="700" letterSpacing={0.4}>
          <TextPath href={`#${footArc}`} startOffset="50%" textAnchor="middle">
            ORGANISE FOR ECONOMIC LIBERTY
          </TextPath>
        </SvgText>
        {[180, 0].map((deg) => {
          const p = at(130, 130, 110, deg);
          return (
            <G key={deg}>
              <Circle cx={p.x} cy={p.y} r={5} fill={`url(#${rim})`} />
              <Circle cx={p.x - 1.2} cy={p.y - 1.2} r={1.6} fill={GOLD_PALE} fillOpacity={0.8} />
            </G>
          );
        })}

        {wreath.berries.map((bb, i) => (
          <Circle key={`b${i}`} cx={bb.x} cy={bb.y} r={2.6} fill={`url(#${leafGold})`} />
        ))}
        {wreath.leaves.map((leaf, i) => (
          <G key={`l${i}`} transform={`rotate(${leaf.rot} ${leaf.x} ${leaf.y})`}>
            <Ellipse cx={leaf.x} cy={leaf.y} rx={12.5} ry={5.2} fill={leaf.gold ? `url(#${leafGold})` : `url(#${leafRoyal})`} />
            {leaf.gold ? <Path d={`M${leaf.x - 10} ${leaf.y} H${leaf.x + 10}`} stroke={GOLD_DEEP} strokeWidth={0.8} strokeOpacity={0.55} /> : null}
          </G>
        ))}

        {[-24, 0, 24].map((deg) => {
          const p = at(130, 134, 56, 90 + deg);
          return <SvgText key={deg} x={p.x} y={p.y + 5} fontSize={14} fill="#1E3A8A" textAnchor="middle">★</SvgText>;
        })}

        {[4, 3, 2, 1].map((d) => (
          <SvgText key={d} x={130} y={134 + d * 1.2} fontSize={40} fontWeight="800" letterSpacing={1.2} textAnchor="middle" fill={GOLD_DEEP} fillOpacity={0.45 + d * 0.13}>
            ACTIV
          </SvgText>
        ))}
        <SvgText x={130} y={134} fontSize={40} fontWeight="800" letterSpacing={1.2} textAnchor="middle" fill="#1E3A8A" stroke={GOLD} strokeWidth={1}>
          ACTIV
        </SvgText>

        <Path d="M52 158 H208 L222 170 L208 182 H52 L38 170 Z" fill={`url(#${rim})`} />
        <Path d="M56 161 H204 V179 H56 Z" fill={`url(#${royal})`} />
        <SvgText x={130} y={174.5} fontSize={banner.length > 12 ? 10 : 12} fontWeight="800" letterSpacing={1.4} textAnchor="middle" fill={GOLD_PALE}>
          {banner}
        </SvgText>

        <Circle cx={130} cy={130} r={129} fill={`url(#${sheen})`} />
      </Svg>
    </View>
  );
}

/* ------------------------------------------------------------------ frames */

const WAVES = Array.from({ length: 12 }, (_, i) => i);

/** Membership: navy frame, gold rules, diagonal bands in all four corners, the foot bar. */
function MembershipFrame({ w, h }: { w: number; h: number }) {
  const navy = useSvgId('mfNavy');
  const royalId = useSvgId('mfRoyal');
  const gold = useSvgId('mfGold');
  const glow = useSvgId('mfGlow');
  if (!w || !h) return null;
  const k = Math.min(w, h) * 0.26; // corner reach
  /** A diagonal stripe between reach a and b from the corner (x0,y0), pointing inwards (sx, sy). */
  const band = (x0: number, y0: number, sx: number, sy: number, a: number, b: number) =>
    `${x0 + sx * a},${y0} ${x0 + sx * b},${y0} ${x0},${y0 + sy * b} ${x0},${y0 + sy * a}`;
  const corner = (x0: number, y0: number, sx: number, sy: number, key: string) => (
    <G key={key}>
      <Polygon points={`${x0},${y0} ${x0 + sx * k * 0.62},${y0} ${x0},${y0 + sy * k * 0.62}`} fill={`url(#${navy})`} />
      <Polygon points={band(x0, y0, sx, sy, k * 0.62, k * 0.68)} fill={`url(#${gold})`} />
      <Polygon points={band(x0, y0, sx, sy, k * 0.68, k * 0.82)} fill={`url(#${royalId})`} fillOpacity={0.9} />
      <Polygon points={band(x0, y0, sx, sy, k * 0.82, k * 0.85)} fill={`url(#${gold})`} />
      <Polygon points={band(x0, y0, sx, sy, k * 0.85, k * 0.96)} fill="#9FB6E4" fillOpacity={0.28} />
    </G>
  );
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgLinearGradient id={navy} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={NAVY_MID} />
          <Stop offset="1" stopColor={NAVY} />
        </SvgLinearGradient>
        <SvgLinearGradient id={royalId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3A5DB4" />
          <Stop offset="1" stopColor={NAVY_SOFT} />
        </SvgLinearGradient>
        <SvgLinearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={GOLD_PALE} />
          <Stop offset="0.45" stopColor={GOLD} />
          <Stop offset="1" stopColor={GOLD_DEEP} />
        </SvgLinearGradient>
        <RadialGradient id={glow} cx="50%" cy="42%" r="70%">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#EEF3FC" />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={`url(#${glow})`} />
      {WAVES.map((i) => {
        const y = 120 + i * ((h - 160) / 11);
        return <Path key={i} d={`M-10 ${y} C ${w * 0.3} ${y - 50}, ${w * 0.65} ${y + 60}, ${w + 10} ${y - 20}`} stroke="#DCE6F7" strokeWidth={1} fill="none" />;
      })}
      {corner(0, 0, 1, 1, 'tl')}
      {corner(w, 0, -1, 1, 'tr')}
      {corner(0, h, 1, -1, 'bl')}
      {corner(w, h, -1, -1, 'br')}
      <Rect x={4} y={4} width={w - 8} height={h - 8} fill="none" stroke={`url(#${navy})`} strokeWidth={8} />
      <Rect x={9.5} y={9.5} width={w - 19} height={h - 19} fill="none" stroke={`url(#${gold})`} strokeWidth={2} />
      <Rect x={18} y={18} width={w - 36} height={h - 36} rx={3} fill="none" stroke={`url(#${gold})`} strokeWidth={1} />
    </Svg>
  );
}

/**
 * THE A4 PAGE. 210 x 297mm = 794 x 1123 at 96dpi — the website sheet's own
 * units. The tax certificate is laid out at exactly this size and then scaled
 * as a whole, so every phone (and the zoom view) shows the identical page.
 */
export const A4_W = A4_WIDTH;
export const A4_H = A4_HEIGHT;

/** White paper and navy/gold corners, matching the website's tax certificate. */
function TaxFrame() {
  const navy = useSvgId('taxNavy');
  const gold = useSvgId('taxGold');
  return (
    <Svg width={A4_W} height={A4_H} viewBox={`0 0 ${A4_W} ${A4_H}`} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <SvgLinearGradient id={navy} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#254875" /><Stop offset="1" stopColor="#0e224a" />
        </SvgLinearGradient>
        <SvgLinearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#dfc28c" /><Stop offset=".5" stopColor="#efddbc" /><Stop offset="1" stopColor="#d7b77f" />
        </SvgLinearGradient>
      </Defs>
      <Rect width={A4_W} height={A4_H} fill="#ffffff" />
      <Path d="M646 0 H794 V143 C764 134 743 106 716 76 Z" fill={`url(#${gold})`} />
      <Path d="M667 0 H794 V119 C769 111 748 83 725 60 Z" fill="#ffffff" />
      <Path d="M680 0 H794 V111 C767 96 752 77 730 54 Z" fill={`url(#${navy})`} />
      <Path d="M794 976 V1123 H642 C691 1075 740 1027 794 976 Z" fill={`url(#${gold})`} />
      <Path d="M794 998 V1123 H664 Z" fill="#ffffff" />
      <Path d="M794 1011 V1123 H676 Z" fill={`url(#${navy})`} />
      <Path d="M794 1034 V1123 H710 Z" fill="#24477a" opacity={0.55} />
    </Svg>
  );
}

/** A 2px gold rule that fades: 'in' (transparent → gold), 'out' (gold → transparent), 'both'. */
function FadeRule({ width, height, fade, color = GOLD }: { width: number; height: number; fade: 'in' | 'out' | 'both'; color?: string }) {
  const id = useSvgId('fr');
  const stops = fade === 'in'
    ? [[0, 0], [1, 1]]
    : fade === 'out' ? [[0, 1], [1, 0]] : [[0, 0], [0.5, 1], [1, 0]];
  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          {stops.map(([o, a]) => <Stop key={o} offset={String(o)} stopColor={color} stopOpacity={a} />)}
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

/* ------------------------------------------------------------------ furniture */

type PdfSheetRef = React.RefObject<View | null>;

/* ------------------------------------------------------------------ membership */

export function MembershipCertificateView({ cert, pdfRef, width, onPress, hint = '' }: {
  cert: any; pdfRef?: PdfSheetRef; width?: number; onPress?: () => void; hint?: string;
}) {
  const [contentHeight, setContentHeight] = useState(0);
  // The complete header and facts shrink together when unusually long records need space.
  const fit = membershipContentScale(contentHeight);
  const member = cert?.member || {};
  const company = String(member?.companyName || member?.name || '—');
  const platinum = String(cert?.membershipTier || '') === 'platinum';
  const validTill = platinum
    ? 'Lifetime'
    : cert?.validUntil ? certDate(cert.validUntil) : String(cert?.membershipType || '') === 'lifetime' ? 'Lifetime' : '';

  const keep = (rows: { icon: string; label: string; value: string }[]) => rows.filter((r) => !!r.value);
  const identity = keep([
    { icon: 'business', label: 'Company Name', value: String(member?.companyName || '') },
    { icon: 'badge', label: 'Membership No.', value: String(member?.membershipNumber || '') },
    { icon: 'person-outline', label: 'Representative', value: String(member?.name || '') },
    { icon: 'workspace-premium', label: 'Udyam Registration', value: String(member?.udyamNumber || '') },
    { icon: 'receipt', label: 'GSTIN', value: String(member?.gstNumber || '') },
    { icon: 'work-outline', label: 'Business Sector', value: String(member?.businessSector || '') },
  ]);
  const address = keep(member?.isInternational
    ? [
      { icon: 'place', label: 'Place', value: String(member?.place || '') },
      { icon: 'public', label: 'Country', value: String(member?.country || '') },
    ]
    : [
      { icon: 'place', label: 'Block', value: String(member?.block || '') },
      { icon: 'place', label: 'District', value: String(member?.district || '') },
      { icon: 'place', label: 'State', value: String(member?.state || '') },
    ]);
  const dates = keep([
    { icon: 'event', label: 'Date of Membership', value: certDate(cert?.memberSince || cert?.activatedAt) },
    { icon: 'event-available', label: 'Valid Till', value: validTill },
    { icon: 'verified', label: 'Membership', value: platinum ? 'Lifetime Member' : '' },
  ]);
  const columns = identity.length <= 3 ? [[...identity, ...dates], address] : [identity, [...address, ...dates]];
  const pairs = Array.from({ length: Math.max(...columns.map(rows => rows.length)) }, (_, index) =>
    [columns[0][index], columns[1][index]]);
  const issued = certDate(cert?.issuedAt);

  return (
    <View>
      <A4Page width={width} onPress={onPress} pdfRef={pdfRef} landscape>
        <View testID="membership-content-block" style={[m.flow, { transformOrigin: 'top center', transform: [{ scale: fit }] }]}
          onLayout={e => setContentHeight(Number(e?.nativeEvent?.layout?.height || 0))}>
          <Image source={LOGO} style={m.logo} resizeMode="contain" accessibilityLabel="ACTIV" />
          <T style={m.association}>{ASSOCIATION_NAME.toUpperCase()}</T>
          <T style={m.title}>MEMBERSHIP CERTIFICATE</T>
          <View style={m.rules}><View style={m.rule} /><T style={m.subtitle}>Empowering SC/ST Entrepreneurs</T><View style={m.rule} /></View>
          <T style={m.certify}>This is to certify that</T>
          <T style={[m.holder, company.length > 40 ? { fontSize: 29, lineHeight: 35 } : company.length > 30 ? { fontSize: 34, lineHeight: 40 } : null]}>{company}</T>
          <View style={m.holderRule} />
          <T style={m.admitted}>has been admitted as {platinum ? 'a Lifetime Member' : 'an official member'} of</T>
          <T style={m.activ}>ACTIV</T>
          <View style={m.panel}>
            {pairs.map((pair, index) => <View key={index} testID={`membership-fact-pair-${index}`}
              style={[m.pair, index < pairs.length - 1 && m.rowBorder]}>
              {pair.map((row, column) => <React.Fragment key={column}>
                {column === 1 ? <View style={m.divider} /> : null}
                <View style={m.row}>
                  {row ? <>
                    <View style={m.factIcon}><Icon name={row.icon} size={20} color={NAVY_MID} /></View>
                    <T style={m.label}>{row.label}</T>
                    <T style={m.value}>{row.value}</T>
                  </> : null}
                </View>
              </React.Fragment>)}
            </View>)}
          </View>
          <View style={[m.rules, { marginTop: 9 }]}><View style={m.rule} /><T style={m.motto}>TOGETHER  ·  TRADE  ·  GROW</T><View style={m.rule} /></View>
        </View>
        <View style={m.signatures} testID="membership-signatories">
          <View style={m.signerColumn} testID="membership-signature-block">
            <T style={m.signerRole}>Founder and Chairperson</T>
            <View style={m.signatureSlot} testID="membership-signature-slot">
              <Image source={SIGNATURE} style={m.signature} resizeMode="contain" accessibilityLabel="Signature of Thamizhazhagan Nallaiyan, Founder and Chairperson" />
            </View>
            <View style={m.signRule} />
            <T style={m.signerName}>THAMIZHAZHAGAN NALLAIYAN</T>
          </View>
          <View style={m.seal} testID="membership-seal-block"><Seal line="Membership" size={112} /><T style={m.sealCaption}>Official Seal</T></View>
          <View style={m.signColumn} testID="membership-issue-block">
            <T style={m.signLabel}>Date of Issue</T>
            <View style={m.issueDate}><T style={m.date}>{issued || '—'}</T></View>
            <View style={m.signRule} />
          </View>
        </View>
        <View style={m.footer}>
          <View style={m.footerReference}><T style={m.footerLabel}>Certificate No.</T><T style={m.footerText}>{cert?.reference || '—'}</T></View>
          <View style={m.footerIssuer}><T style={[m.footerText, m.footerRight]}>Issued by: ACTIV | Chennai, Tamil Nadu</T><T style={[m.footerText, m.footerRight]}>www.activ.org.in</T></View>
        </View>
      </A4Page>
      {hint ? <Text style={m.hint}>{hint}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------------ tax exemption (80G) */

/**
 * Type on the A4 page never follows the phone's font-size setting: the page is
 * a document, and a member with large text would otherwise get a different
 * page (re-wrapped lines, a clipped foot) from everyone else.
 */
const T = (props: React.ComponentProps<typeof Text>) => <Text allowFontScaling={false} {...props} />;

/**
 * One fixed A4 page, scaled uniformly as a picture. The wrapper holds the exact
 * 794:1123 (1 : 1.4143) aspect at whatever width it is given — `width` when the
 * caller fixes it (the zoom view), otherwise the width its parent offers.
 */
function A4Page({ width, onPress, children, pdfRef, landscape = false }: { width?: number; onPress?: () => void; children: React.ReactNode; pdfRef?: PdfSheetRef; landscape?: boolean }) {
  const pageW = landscape ? A4_H : A4_W;
  const pageH = landscape ? A4_W : A4_H;
  const fixed = typeof width === 'number' && width > 0 ? width : 0;
  const [measured, setMeasured] = useState(0);
  const w = fixed || measured;
  const scale = w > 0 ? w / pageW : 0;
  const sheet = (
    <View
      style={[f.a4Shadow, fixed ? { width: fixed, height: Math.round((fixed * pageH) / pageW) } : { width: '100%', aspectRatio: pageW / pageH }]}
      onLayout={(e: LayoutChangeEvent) => {
        if (fixed) return;
        const next = Number(e?.nativeEvent?.layout?.width || 0);
        if (next > 0 && Math.abs(next - measured) > 0.5) setMeasured(next);
      }}
    >
      <View style={f.a4Clip}>
        {scale > 0 ? (
          <View ref={pdfRef} collapsable={false} style={[f.a4Sheet, { width: pageW, height: pageH, transformOrigin: 'top left', transform: [{ scale }] }]}>
            {landscape ? <MembershipFrame w={pageW} h={pageH} /> : <TaxFrame />}
            {children}
          </View>
        ) : null}
      </View>
    </View>
  );
  if (typeof onPress !== 'function') return sheet;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={landscape ? "Membership certificate, A4 landscape page" : "Certificate of Tax Exemption, A4 page"}
      accessibilityHint="Opens the certificate full screen, where it can be enlarged"
    >
      {sheet}
    </Pressable>
  );
}

/**
 * Formal A4 letter shared by member certificates, donation receipts and annual
 * statements. The field order and wording match the website certificate.
 */
export function TaxCertificateView({ cert, stamp = '', receiptColumn = false, amountInWords = '', width, onPress, hint = '', pdfRef }: {
  cert: any; stamp?: string; receiptColumn?: boolean; amountInWords?: string;
  width?: number; onPress?: () => void; hint?: string; pdfRef?: PdfSheetRef;
}) {
  const member = cert?.member || {};
  const contribution = cert?.contribution;
  const isAmount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
  const listed = asArray<any>(contribution?.payments);
  const payments: any[] = listed.length ? listed
    : contribution && (isAmount(contribution.amount) || contribution.receivedOn)
      ? [{ date: contribution.receivedOn, amount: contribution.amount, mode: '', reference: contribution.reference }]
      : [];
  const total = payments.length && payments.every(payment => isAmount(payment?.amount))
    ? payments.reduce((sum, payment) => sum + payment.amount, 0)
    : isAmount(contribution?.amount) ? contribution.amount : null;
  const words = amountInWords || spellAmount(total);
  const issued = certDate(cert?.issuedAt, '-');
  const financialYear = fullYear(cert?.financialYear || '');
  const dense = payments.length > 6;

  // Shrink the complete flow when long names or annual payment lists need more
  // space. Measure again after all content changes so the address stays visible.
  const [fit, setFit] = useState(1);
  const tries = useRef(0);
  const signature = JSON.stringify([cert, stamp, receiptColumn, amountInWords]);
  // Reset before native onLayout. A passive effect can overwrite the first
  // measured scale and leave a long annual statement clipped at scale 1.
  useLayoutEffect(() => { tries.current = 0; setFit(1); }, [signature]);
  const onFlowLayout = (event: LayoutChangeEvent) => {
    const height = Number(event.nativeEvent.layout.height || 0);
    if (height > A4_H / fit + 1 && tries.current < 8) {
      tries.current += 1;
      setFit(Math.min(fit * 0.995, A4_H / height));
    }
  };
  const textStyle = [f.taxParagraph, dense && f.taxParagraphDense];
  const onClosingLayout = (event: LayoutChangeEvent) => {
    // An absolute flow's height can be constrained by its A4 parent even when
    // the children overflow. Measure the footer's bottom to include all rows.
    const { y, height } = event.nativeEvent.layout;
    onFlowLayout({ nativeEvent: { layout: { height: y + height + 32 } } } as LayoutChangeEvent);
  };
  const columns = [
    { title: 'Date', flex: 0.27 },
    { title: 'Amount', flex: 0.32 },
    { title: receiptColumn ? 'Receipt No.' : 'Invoice / Payment ID', flex: 0.41 },
  ];
  const cell = (index: number) => [
    f.taxCell, { flex: columns[index].flex, paddingVertical: dense ? 4 : 9 },
    index > 0 && f.taxCellBorder,
  ];
  const cellText = (index: number) => [
    f.taxCellText, dense && f.taxCellTextDense, index === 0 && f.taxCellTextLeft,
  ];

  return (
    <View>
      <A4Page width={width} onPress={onPress} pdfRef={pdfRef}>
        <View onLayout={onFlowLayout} style={[
          f.a4Flow, dense && { paddingTop: 28 },
          { width: A4_W / fit, minHeight: A4_H / fit, transformOrigin: 'top left', transform: [{ scale: fit }] },
        ]}>
          <View style={f.taxHeader}>
            <Image source={LOGO} style={[f.taxLogo, dense && { height: 64, marginBottom: 17 }]}
              resizeMode="contain" accessibilityLabel={ASSOCIATION_NAME} />
            <T style={f.taxAssociation}>{ASSOCIATION_NAME.toUpperCase()}</T>
            <T style={[f.taxTitle, dense && { fontSize: 38, lineHeight: 46, marginTop: 12 }]}>Tax Exemption Certificate</T>
            <View style={f.taxSection}>
              <View style={f.taxRule} />
              <T style={f.taxSectionText}>UNDER SECTION 80G - INCOME TAX ACT, 1961</T>
              <View style={f.taxRule} />
            </View>
            {stamp ? <View style={f.taxStamp}><T style={f.taxStampText}>{stamp}</T></View> : null}
          </View>

          <View style={[f.taxBody, dense && { marginTop: 22 }]}>
            <T style={f.taxDetail}><T style={f.taxBold}>Certificate No. :  </T>{cert?.reference || '—'}</T>
            <T style={f.taxDetail}><T style={f.taxBold}>Date :  </T>{issued || '—'}</T>
            {member.pan ? <T style={f.taxDetail}><T style={f.taxBold}>Donor PAN :  </T>{member.pan}</T> : null}

            <T style={[textStyle, { marginTop: dense ? 18 : 29 }]}>
              This is to certify that <T style={f.taxBold}>{member.name || 'the donor'}</T> has contributed
              {total !== null ? <T> a total amount of <T style={f.taxBold}>{certRupees(total)}{words ? ` (${words})` : ''}</T></T> : null}
              {' '}to the {ASSOCIATION_NAME} (ACTIV), and the contribution is eligible for exemption under Section 80G of the Income Tax Act, 1961.
            </T>

            {payments.length ? (
              <View style={[f.taxTable, dense && { marginTop: 18 }]} accessibilityLabel="Contribution payment details">
                <View style={[f.taxRow, f.taxTableHead]}>
                  {columns.map((column, index) => (
                    <View key={column.title} style={cell(index)}>
                      <T style={[cellText(index), f.taxBold]}>{column.title}</T>
                    </View>
                  ))}
                </View>
                {payments.map((payment, index) => (
                  <View key={index} style={[f.taxRow, f.taxRowBorder]}>
                    <View style={cell(0)}><T style={cellText(0)}>{certDate(payment?.date, '-') || '—'}</T></View>
                    <View style={cell(1)}>
                      <T style={cellText(1)}>{certRupees(payment?.amount)}</T>
                      {payment?.mode ? <T style={[f.taxPaymentMode, dense && { fontSize: 9 }]}>{payment.mode}</T> : null}
                    </View>
                    <View style={cell(2)}><T style={cellText(2)}>{payment?.reference || '—'}</T></View>
                  </View>
                ))}
              </View>
            ) : null}

            <T style={[textStyle, { marginTop: dense ? 20 : 28 }]}>
              We thank you for your contribution to the {ASSOCIATION_NAME} and for supporting our work for community growth and empowerment.
            </T>
            <T style={[f.taxOfficeAddress, dense && { marginTop: 18, fontSize: 12 }]}>
              6&amp;7, Hayagreeva Apartment,{'\n'}
              121, Velachery Main Road,{'\n'}
              Chennai - 600032, India{'\n'}
              Email: {EMAIL}
            </T>
          </View>

          <View style={[f.taxClosing, dense && { paddingTop: 18 }]} onLayout={onClosingLayout}>
            <View style={f.taxMotto}>
              <View style={f.taxRule} />
              <T style={f.taxMottoText}>Your support empowers communities and creates{'\n'}opportunities for a better tomorrow.</T>
              <View style={f.taxRule} />
            </View>
            <View style={[f.taxFooter, dense && { marginTop: 16 }]}>
              <T style={f.taxFooterName}>{ASSOCIATION_NAME.toUpperCase()}</T>
              <View style={f.taxFooterAddress}>
                <Icon name="place" size={15} color="#315583" />
                <T style={f.taxFooterText}>{ADDRESS}</T>
              </View>
              <View style={f.taxContacts}>
                <View style={f.taxContact}><Icon name="phone" size={14} color="#315583" /><T style={f.taxFooterText}>{PHONE}</T></View>
                <T style={f.taxFooterText}>|</T>
                <View style={f.taxContact}><Icon name="mail-outline" size={15} color="#315583" /><T style={f.taxFooterText}>{EMAIL}</T></View>
                <T style={f.taxFooterText}>|</T>
                <View style={f.taxContact}><Icon name="language" size={14} color="#315583" /><T style={f.taxFooterText}>{WEB}</T></View>
              </View>
              <View style={f.taxReference}>
                <T style={f.taxReferenceText}>Certificate No: {cert?.reference || '—'}{'   |   '}Date: {issued || '—'}</T>
                <T style={f.taxReferenceText}>Issued By: {cert?.issuedBy || 'ACTIV'}{financialYear ? `   |   Valid for Financial Year: ${financialYear}` : ''}</T>
              </View>
            </View>
          </View>
        </View>
      </A4Page>
      {hint ? (
        <View style={f.a4Hint}><Icon name="zoom-in" size={16} color={MUTED} /><Text style={f.a4HintText}>{hint}</Text></View>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ styles */

const m = StyleSheet.create({
  flow: { position: 'absolute', top: MEMBERSHIP_PAGE.contentTop, left: MEMBERSHIP_PAGE.side, right: MEMBERSHIP_PAGE.side, alignItems: 'center' },
  logo: { width: 212, height: 66 },
  association: { fontSize: 13.5, lineHeight: 20, fontWeight: '700', letterSpacing: 1.5, color: NAVY_MID, textAlign: 'center', marginTop: 4 },
  title: { fontFamily: 'serif', fontSize: 49, lineHeight: 59, fontWeight: '700', color: NAVY, textAlign: 'center', marginTop: 6 },
  rules: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 4 },
  rule: { height: 1.5, width: 150, backgroundColor: GOLD },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: GOLD_DEEP },
  certify: { fontSize: 18, lineHeight: 25, fontStyle: 'italic', color: INK, marginTop: 6 },
  holder: { fontSize: 40, lineHeight: 46, fontWeight: '800', color: NAVY, textAlign: 'center', maxWidth: 860, marginTop: 2 },
  holderRule: { width: 440, height: 1.5, backgroundColor: GOLD, marginTop: 4 },
  admitted: { fontSize: 17, lineHeight: 24, color: INK, textAlign: 'center', marginTop: 4 },
  activ: { fontSize: 20, lineHeight: 27, fontWeight: '700', color: NAVY },
  panel: { alignSelf: 'stretch', marginTop: 8, borderRadius: 16, borderWidth: 1, borderColor: PANEL_LINE, backgroundColor: '#FFFFFFE8', paddingHorizontal: 20, paddingVertical: 6 },
  pair: { flexDirection: 'row', alignItems: 'stretch', gap: 18 },
  divider: { width: 2, marginVertical: 4, backgroundColor: GOLD_LIGHT },
  row: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 8, minHeight: 33, paddingVertical: 4 },
  factIcon: { width: 28, paddingTop: 1 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: LINE },
  label: { width: 126, fontSize: 13.5, lineHeight: 20, color: MUTED, fontWeight: '500' },
  value: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: 15, lineHeight: 20, color: INK, fontWeight: '700' },
  motto: { fontSize: 14, lineHeight: 22, letterSpacing: 3, color: NAVY_MID, fontWeight: '700' },
  signatures: { position: 'absolute', top: MEMBERSHIP_PAGE.signaturesTop, left: MEMBERSHIP_PAGE.signaturesSide, right: MEMBERSHIP_PAGE.signaturesSide, height: MEMBERSHIP_PAGE.signatureHeight, flexDirection: 'row', alignItems: 'flex-start' },
  signColumn: { flex: 1, minWidth: 0, alignItems: 'center' },
  signerColumn: { flex: 1, minWidth: 0, alignItems: 'center' },
  signerRole: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: NAVY, textAlign: 'center' },
  signerName: { fontSize: 12, lineHeight: 18, marginTop: 3, fontWeight: '800', color: NAVY, textAlign: 'center' },
  signLabel: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: NAVY, textAlign: 'center' },
  signatureSlot: { width: 220, height: MEMBERSHIP_SIGNATURE.height, alignItems: 'center', justifyContent: 'center' },
  signature: { width: MEMBERSHIP_SIGNATURE.width, height: MEMBERSHIP_SIGNATURE.height, tintColor: NAVY_MID, transform: [{ translateX: MEMBERSHIP_SIGNATURE.translateX }, { translateY: MEMBERSHIP_SIGNATURE.translateY }, { rotate: MEMBERSHIP_SIGNATURE.rotate }] },
  signRule: { width: 220, height: 1, backgroundColor: NAVY_MID },
  seal: { flex: 1, minWidth: 0, alignItems: 'center' },
  sealCaption: { fontSize: 12, lineHeight: 16, color: NAVY_MID },
  issueDate: { height: MEMBERSHIP_SIGNATURE.height, justifyContent: 'center' },
  date: { fontSize: 24, fontWeight: '700', color: NAVY_MID },
  footer: { position: 'absolute', left: 22, right: 22, top: MEMBERSHIP_PAGE.footerTop, height: 40, paddingHorizontal: 18, borderTopWidth: 2, borderTopColor: GOLD, backgroundColor: NAVY, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  footerReference: { flex: 1.4, minWidth: 0 },
  footerIssuer: { flex: 1, minWidth: 0 },
  footerLabel: { fontSize: 9, lineHeight: 11, color: GOLD_PALE },
  footerText: { fontSize: 11, lineHeight: 13, color: '#FFF', flexShrink: 1 },
  footerRight: { textAlign: 'right' },
  hint: { fontSize: 13, lineHeight: 20, textAlign: 'center', color: MUTED, marginTop: 12 },
});

const f = StyleSheet.create({
  // Shadow on the wrapper, clipping on the sheet — iOS drops a shadow on a clipped view.
  paperShadow: { borderRadius: RADIUS.xs, backgroundColor: PAPER, ...SHADOW.lifted, shadowColor: '#0B1A45', shadowOpacity: 0.2 },
  paper: { backgroundColor: PAPER, borderRadius: RADIUS.xs, overflow: 'hidden' },
  content: { paddingHorizontal: 26, paddingTop: 34, paddingBottom: 22, alignItems: 'center' },

  logo: { width: 132, height: 41 },
  assoc: { fontSize: 9.5, fontWeight: '800', color: NAVY_MID, textAlign: 'center', marginTop: 4, letterSpacing: 1, lineHeight: 13 },
  titleBig: { fontSize: 25, fontWeight: '900', color: NAVY, textAlign: 'center', marginTop: 14, letterSpacing: 1, lineHeight: 29 },
  rules: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, alignSelf: 'stretch', justifyContent: 'center' },
  rule: { flex: 1, maxWidth: 40, height: 1.5, backgroundColor: GOLD },
  subGold: { fontSize: 12, fontWeight: '800', color: GOLD_DEEP, textAlign: 'center' },
  certify: { fontSize: 13, fontStyle: 'italic', color: INK, marginTop: 16 },
  holder: { fontSize: 23, lineHeight: 28, fontWeight: '900', color: NAVY, textAlign: 'center', marginTop: 4 },
  goldLine: { width: '70%', height: 1.5, backgroundColor: GOLD, marginTop: 6, opacity: 0.8 },
  admitted: { fontSize: 13, color: INK, marginTop: 6, textAlign: 'center' },
  activ: { fontSize: 16, fontWeight: '900', color: NAVY, marginTop: 1 },

  panel: { alignSelf: 'stretch', marginTop: 16, borderWidth: 1, borderColor: PANEL_LINE, borderRadius: RADIUS.md, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 14, paddingVertical: 4 },
  fact: { flexDirection: 'row', gap: 10, paddingVertical: 9 },
  factDivider: { borderBottomWidth: 1, borderBottomColor: LINE },
  factDividerTop: { borderTopWidth: 1, borderTopColor: LINE },
  factLabel: { fontSize: 11, fontWeight: '600', color: MUTED },
  factValue: { fontSize: 14, fontWeight: '800', color: INK, marginTop: 1 },

  motto: { fontSize: 10.5, fontWeight: '800', color: NAVY_MID, letterSpacing: 2.2, textAlign: 'center' },

  signRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 16, gap: 6 },
  signCol: { flex: 1, minWidth: 0, alignItems: 'center' },
  sealCol: { alignItems: 'center' },
  signature: { width: '100%', height: 40, marginTop: 2, tintColor: NAVY_MID },
  dateBox: { height: 40, justifyContent: 'flex-end', paddingBottom: 3, marginTop: 2 },
  signDate: { fontSize: 14, fontWeight: '800', color: NAVY_MID },
  signLine: { alignSelf: 'stretch', height: 1, backgroundColor: NAVY_MID, opacity: 0.7, marginBottom: 22 },
  signLabel: { fontSize: 11, fontWeight: '800', color: NAVY, textAlign: 'center' },
  sealCaption: { fontSize: 10.5, fontWeight: '700', color: NAVY, marginTop: 2 },

  footBar: { backgroundColor: NAVY, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 3, borderTopColor: GOLD },
  footText: { color: '#FFFFFF', fontSize: 12 },
  footTextSmall: { color: 'rgba(255,255,255,0.8)', fontSize: 10.5, marginTop: 3 },

  // Fixed A4 canvas, then scale the whole document to the available screen.
  a4Shadow: { borderRadius: 2, backgroundColor: '#fff', ...SHADOW.lifted, shadowColor: '#0B1A45', shadowOpacity: 0.2 },
  a4Fluid: { width: '100%', aspectRatio: A4_W / A4_H },
  a4Clip: { ...StyleSheet.absoluteFillObject, borderRadius: 2, overflow: 'hidden' },
  a4Sheet: { position: 'absolute', left: 0, top: 0, width: A4_W, height: A4_H, backgroundColor: '#fff', overflow: 'hidden' },
  a4Flow: { flexShrink: 0, flexDirection: 'column', paddingTop: 42, paddingHorizontal: 70, paddingBottom: 32 },
  taxHeader: { alignItems: 'center', flexShrink: 0 },
  taxLogo: { width: 266, height: 84, marginBottom: 28 },
  taxAssociation: { fontSize: 15, lineHeight: 21, fontWeight: '600', letterSpacing: 0.75, color: '#182d50', textAlign: 'center' },
  taxTitle: { marginTop: 17, marginHorizontal: -8, fontSize: 43, lineHeight: 52, letterSpacing: -1.1, fontWeight: '700', color: '#091e50', textAlign: 'center' },
  taxSection: { marginTop: 13, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 15 },
  taxRule: { height: 1.5, flex: 1, backgroundColor: '#c5a365' },
  taxSectionText: { fontSize: 12.5, lineHeight: 19, fontWeight: '600', letterSpacing: 2.2, color: '#233a5c', textAlign: 'center' },
  taxStamp: { marginTop: 13, maxWidth: '100%', borderWidth: 1, borderColor: '#ddc79c', borderRadius: 4, backgroundColor: '#fffbf0', paddingVertical: 3, paddingHorizontal: 10 },
  taxStampText: { fontSize: 11, lineHeight: 17, color: '#705321', textAlign: 'center' },
  taxBody: { marginTop: 40, flexShrink: 0 },
  taxDetail: { fontSize: 16, lineHeight: 26, color: '#182d50', marginBottom: 3 },
  taxBold: { fontWeight: '700', color: '#102c59' },
  taxParagraph: { fontSize: 16, lineHeight: 27, color: '#182d50' },
  taxParagraphDense: { fontSize: 14, lineHeight: 23 },
  taxTable: { marginTop: 25, borderWidth: 1, borderColor: '#ccdaea', borderRadius: 6, overflow: 'hidden' },
  taxRow: { flexDirection: 'row', alignItems: 'stretch' },
  taxTableHead: { backgroundColor: '#edf1f6' },
  taxRowBorder: { borderTopWidth: 1, borderTopColor: '#ccdaea' },
  taxCell: { paddingHorizontal: 17, justifyContent: 'center', minWidth: 0 },
  taxCellBorder: { borderLeftWidth: 1, borderLeftColor: '#ccdaea' },
  taxCellText: { fontSize: 15, lineHeight: 23, color: '#182d50', textAlign: 'right' },
  taxCellTextDense: { fontSize: 12, lineHeight: 18 },
  taxCellTextLeft: { textAlign: 'left' },
  taxPaymentMode: { marginTop: 1, fontSize: 10.5, lineHeight: 14, color: '#536987', textAlign: 'right' },
  taxOfficeAddress: { marginTop: 28, fontSize: 13, lineHeight: 20, color: '#455e80' },
  taxClosing: { marginTop: 'auto', paddingTop: 22, flexShrink: 0 },
  taxMotto: { flexDirection: 'row', alignItems: 'center', gap: 17 },
  taxMottoText: { fontSize: 12.5, lineHeight: 19.5, fontStyle: 'italic', color: '#455e80', textAlign: 'center' },
  taxFooter: { marginTop: 23, borderTopWidth: 1, borderTopColor: '#cfdae8', paddingTop: 12, alignItems: 'center' },
  taxFooterName: { fontSize: 13, lineHeight: 19.5, fontWeight: '700', letterSpacing: 0.35, color: '#12366a', textAlign: 'center' },
  taxFooterAddress: { marginTop: 7, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 8 },
  taxFooterText: { fontSize: 10.5, lineHeight: 16, color: '#315583', flexShrink: 1, textAlign: 'center' },
  taxContacts: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13 },
  taxContact: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  taxReference: { marginTop: 11, paddingTop: 8, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: '#cfdae8', gap: 3 },
  taxReferenceText: { fontSize: 10, lineHeight: 16.5, color: '#315583', textAlign: 'center' },
  a4Hint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10 },
  a4HintText: { fontSize: 12, color: MUTED },
});
