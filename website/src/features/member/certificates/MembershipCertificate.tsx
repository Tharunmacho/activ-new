import {
    Building2, IdCard, UserRound, FileBadge, Receipt, Briefcase, MapPin, CalendarDays, CalendarCheck, FileText, Globe, BadgeCheck,
} from 'lucide-react';
import { CertificateSheet, SignatureInk, ASSOCIATION_NAME } from './CertificateSheet';
import { CertificateMedallion, GOLD, GOLD_LIGHT, GOLD_PALE, GOLD_DEEP } from './CertificateMedallion';
import type { Certificate } from '@/services/activApi';

/**
 * ============================================================================
 * THE MEMBERSHIP CERTIFICATE — A4 LANDSCAPE, THE ASSOCIATION'S TEMPLATE
 * ============================================================================
 *
 * Laid out to the association's own template, element for element:
 *
 *   a heavy navy frame with a gold rule inside it, broad navy + gold diagonal
 *   bands across all four corners, navy bars along the foot
 *   the mark CENTRED, the association's full name under it
 *   MEMBERSHIP CERTIFICATE / the gold sub-line
 *   the member company, "admitted as an official member of ACTIV"
 *   a two-column facts panel with icons, split by a gold diamond
 *   TOGETHER · TRADE · GROW
 *   ONE signature — the Founder President's — the seal in the centre, and the
 *   date of issue opposite the signature. NO QR code (the association's
 *   instruction).
 *
 * NOTHING IS INVENTED: a fact the server did not send is left out of the panel,
 * and the company name falls back to the member's own name.
 *
 * 297 x 210mm = 1123 x 794px at 96dpi; the frame SVG and every absolute offset
 * below are drawn in those units.
 */

const NAVY = '#0E1F4D';
const NAVY_MID = '#1C2E68';
const NAVY_SOFT = '#2A4A9A';
const INK = '#13224F';
const MUTED = '#5B6B8F';

const date = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/* ------------------------------------------------------------------ frame */

function Frame() {
    return (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1123 794"
             preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <linearGradient id="mc-navy" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={NAVY_MID} /><stop offset="1" stopColor={NAVY} />
                </linearGradient>
                <linearGradient id="mc-royal" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#3A5DB4" /><stop offset="1" stopColor={NAVY_SOFT} />
                </linearGradient>
                <linearGradient id="mc-gold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={GOLD_PALE} /><stop offset="0.45" stopColor={GOLD} /><stop offset="1" stopColor={GOLD_DEEP} />
                </linearGradient>
                <linearGradient id="mc-bar" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor={NAVY} /><stop offset="1" stopColor={NAVY_MID} />
                </linearGradient>
                <radialGradient id="mc-glow" cx="0.5" cy="0.42" r="0.62">
                    <stop offset="0" stopColor="#FFFFFF" /><stop offset="1" stopColor="#EEF3FC" />
                </radialGradient>
            </defs>

            <rect x="0" y="0" width="1123" height="794" fill="url(#mc-glow)" />

            {/* faint guilloche waves across the paper */}
            <g fill="none" stroke="#DCE6F7" strokeWidth="1" opacity="0.8">
                {Array.from({ length: 10 }, (_, i) => (
                    <path key={i} d={`M-20 ${150 + i * 60} C 300 ${80 + i * 60}, 760 ${250 + i * 60}, 1150 ${130 + i * 60}`} />
                ))}
            </g>

            {/* the heavy outer frame: navy, a gold line inside it */}
            <rect x="7" y="7" width="1109" height="780" fill="none" stroke="url(#mc-navy)" strokeWidth="14" />
            <rect x="15.5" y="15.5" width="1092" height="763" fill="none" stroke="url(#mc-gold)" strokeWidth="3" />
            {/* the thin gold inner rule */}
            <rect x="30" y="30" width="1063" height="734" rx="4" fill="none" stroke="url(#mc-gold)" strokeWidth="1.3" />

            {/* ---------------- top-left: broad diagonal bands */}
            <polygon points="0,0 150,0 0,150" fill="url(#mc-navy)" />
            <polygon points="150,0 163,0 0,163 0,150" fill="url(#mc-gold)" />
            <polygon points="163,0 194,0 0,194 0,163" fill="url(#mc-royal)" opacity="0.92" />
            <polygon points="194,0 200,0 0,200 0,194" fill="url(#mc-gold)" />
            <polygon points="200,0 226,0 0,226 0,200" fill="#9FB6E4" opacity="0.28" />

            {/* ---------------- top-right */}
            <polygon points="1123,0 1018,0 1123,138" fill="url(#mc-navy)" />
            <polygon points="1018,0 1004,0 1123,156 1123,138" fill="url(#mc-gold)" />
            <polygon points="1004,0 978,0 1123,190 1123,156" fill="url(#mc-royal)" opacity="0.9" />
            <polygon points="978,0 972,0 1123,198 1123,190" fill="url(#mc-gold)" />

            {/* ---------------- bottom-left: diagonal bands, and the bar carrying the certificate number */}
            <polygon points="0,560 0,794 234,794" fill="url(#mc-navy)" />
            <polygon points="0,546 0,560 234,794 250,794" fill="url(#mc-gold)" />
            <polygon points="0,512 0,546 250,794 284,794" fill="url(#mc-royal)" opacity="0.88" />
            <polygon points="0,505 0,512 284,794 292,794" fill="url(#mc-gold)" />
            <polygon points="0,730 500,730 470,776 0,776" fill="url(#mc-bar)" />
            <polygon points="500,730 508,730 478,776 470,776" fill="url(#mc-gold)" />
            <rect x="0" y="776" width="478" height="3" fill="url(#mc-gold)" />

            {/* ---------------- bottom-right: the heaviest corner, as the template has it */}
            <polygon points="1123,470 1123,794 890,794" fill="url(#mc-navy)" />
            <polygon points="1123,452 1123,470 890,794 868,794" fill="url(#mc-gold)" />
            <polygon points="1123,404 1123,452 868,794 832,794" fill="url(#mc-royal)" opacity="0.9" />
            <polygon points="1123,396 1123,404 832,794 822,794" fill="url(#mc-gold)" />
            <polygon points="1123,360 1123,396 822,794 790,794" fill="#9FB6E4" opacity="0.25" />
            <polygon points="660,730 1123,730 1123,776 630,776" fill="url(#mc-bar)" />
            <polygon points="652,730 660,730 630,776 622,776" fill="url(#mc-gold)" />
            <rect x="622" y="776" width="501" height="3" fill="url(#mc-gold)" />

            {/* skyline and gears, faint, bottom left above the bar — the template's motif */}
            <g fill="none" stroke="#B9C8E6" strokeWidth="1.3" opacity="0.95" transform="translate(58 612) scale(1.05)">
                <path d="M0 100 V58 H14 V40 H26 V100 M26 100 V30 H40 V100 M40 100 V6 H50 V0 H54 V6 H62 V100 M62 100 V44 H78 V100 M78 100 V22 H90 V100 M90 100 V52 H108 V100 M108 100 V34 H120 V100" />
                <path d="M4 66 H22 M4 76 H22 M30 44 H36 M30 56 H36 M30 68 H36 M44 20 H58 M44 34 H58 M44 48 H58 M44 62 H58 M82 36 H86 M82 50 H86 M82 64 H86" opacity="0.8" />
                <circle cx="140" cy="84" r="14" /><circle cx="140" cy="84" r="5" />
                <circle cx="164" cy="70" r="9" /><circle cx="164" cy="70" r="3" />
            </g>
        </svg>
    );
}

/* ------------------------------------------------------------ furniture */

type RowData = { icon: typeof Building2; label: string; value: string };

function Row({ icon: Icon, label, value, last }: RowData & { last: boolean }) {
    return (
        <div className={`grid min-h-[33px] grid-cols-[28px_144px_minmax(0,1fr)] items-center gap-x-2 py-[3px] ${last ? '' : 'border-b'}`}
             style={{ borderColor: '#E3EAF6' }}>
            <Icon className="h-[21px] w-[21px]" style={{ color: NAVY_MID }} strokeWidth={2.1} />
            <span className="text-[14px] font-medium" style={{ color: MUTED }}>{label}</span>
            <span className="break-words text-[15px] font-semibold leading-snug" style={{ color: INK }}>{value}</span>
        </div>
    );
}

function Rules({ children, width = 'w-24', className = '' }: { children: React.ReactNode; width?: string; className?: string }) {
    return (
        <div className={`flex items-center justify-center gap-4 ${className}`}>
            <span className={`h-[1.5px] ${width}`} style={{ background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
            {children}
            <span className={`h-[1.5px] ${width}`} style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
        </div>
    );
}

export default function MembershipCertificate({ cert }: { cert: Certificate }) {
    const member = cert.member || ({} as Certificate['member']);
    const company = member.companyName || member.name || '—';
    const platinum = cert.membershipTier === 'platinum';
    const validTill = platinum
        ? 'Lifetime'
        : cert.validUntil ? date(cert.validUntil) : cert.membershipType === 'lifetime' ? 'Lifetime' : '';

    /* One ordered list, split down the middle: with every fact present that is
       exactly the template's five-and-four; with some missing, the two columns
       stay within one row of each other instead of one running dry. */
    /*
     * Three groups, and the ADDRESS IS NEVER SPLIT across the two columns —
     * Block / District / State read as one unit, top to bottom.
     *
     * With a short identity block (no company facts on record) the dates join
     * it on the left and the address stands alone on the right; with a full
     * one, the dates go under the address instead. Either way the columns stay
     * within a row or two of each other.
     */
    const keep = (list: RowData[]) => list.filter((r) => !!r.value);
    const identity = keep([
        { icon: Building2, label: 'Company Name', value: member.companyName || '' },
        { icon: IdCard, label: 'Membership No.', value: member.membershipNumber || '' },
        { icon: UserRound, label: 'Representative', value: member.name || '' },
        { icon: FileBadge, label: 'Udyam Registration', value: member.udyamNumber || '' },
        { icon: Receipt, label: 'GSTIN', value: member.gstNumber || '' },
        { icon: Briefcase, label: 'Business Sector', value: member.businessSector || '' },
    ]);
    /* The address as its parts, one labelled row each — never one
       comma-joined line. Outside India: the place and the country. */
    const address = keep(member.isInternational
        ? [
            { icon: MapPin, label: 'Place', value: member.place || '' },
            { icon: Globe, label: 'Country', value: member.country || '' },
        ]
        : [
            { icon: MapPin, label: 'Block', value: member.block || '' },
            { icon: MapPin, label: 'District', value: member.district || '' },
            { icon: MapPin, label: 'State', value: member.state || '' },
        ]);
    const dates = keep([
        { icon: CalendarDays, label: 'Date of Membership', value: date(cert.memberSince || cert.activatedAt) },
        { icon: CalendarCheck, label: 'Valid Till', value: validTill },
        { icon: BadgeCheck, label: 'Membership', value: platinum ? 'Lifetime Member' : '' },
    ]);
    const columns = identity.length <= 3
        ? [[...identity, ...dates], address]
        : [identity, [...address, ...dates]];
    const rows = [...columns[0], ...columns[1]];

    const nameSize = company.length > 40 ? 'text-[29px]' : company.length > 30 ? 'text-[34px]' : 'text-[40px]';
    const issued = date(cert.issuedAt);

    return (
        <CertificateSheet size="a4-landscape" bleed onePage letterhead={false} registrations={false} footNote={null}>
            <div className="relative flex w-full flex-1 flex-col overflow-hidden" style={{ background: '#FBFCFF', color: INK }}>
                <Frame />

                {/* ============================================ head: the mark, centred, and whose it is */}
                <header className="relative z-10 flex flex-col items-center px-[150px] pt-[38px] text-center">
                    <img src="/logo_ACTIVian-removebg-preview.png" alt={ASSOCIATION_NAME} className="h-[66px] w-auto object-contain" />
                    <p className="mt-1 text-[13.5px] font-bold uppercase tracking-[0.16em]" style={{ color: NAVY_MID }}>
                        {ASSOCIATION_NAME}
                    </p>
                </header>

                {/* ============================================ title */}
                <div className="relative z-10 mt-[6px] px-[120px] text-center">
                    <h1 className="font-certificate text-[54px] font-bold uppercase leading-[1.08] tracking-[0.02em]" style={{ color: NAVY }}>
                        Membership Certificate
                    </h1>
                    <Rules width="w-[150px]" className="mt-1">
                        <p className="text-[18px] font-bold tracking-[0.02em]" style={{ color: GOLD_DEEP }}>Empowering SC/ST Entrepreneurs</p>
                    </Rules>
                </div>

                {/* ============================================ holder */}
                <div className="relative z-10 mt-[6px] px-[120px] text-center">
                    <p className="text-[18px] italic" style={{ color: INK }}>This is to certify that</p>
                    <p className={`mx-auto mt-0.5 max-w-[860px] break-words font-extrabold leading-[1.15] ${nameSize}`} style={{ color: NAVY }}>
                        {company}
                    </p>
                    <span className="mx-auto mt-1 block h-[1.5px] w-[440px]" style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }} />
                    <p className="mt-1 text-[17px]" style={{ color: INK }}>
                        has been admitted as {platinum ? 'a Lifetime Member' : 'an official member'} of
                    </p>
                    <p className="text-[20px] font-bold" style={{ color: NAVY }}>ACTIV</p>
                </div>

                {/* ============================================ the facts panel */}
                {rows.length > 0 && (
                    <div className="relative z-10 mx-[92px] mt-[8px] grid grid-cols-[minmax(0,1.12fr)_2px_minmax(0,1fr)] gap-x-6 rounded-2xl border bg-white/85 px-6 py-1.5"
                         style={{ borderColor: '#CFDBF1', boxShadow: '0 8px 26px -16px rgba(14,31,77,0.38)' }}>
                        <div>
                            {columns[0].map((r, i) => <Row key={r.label} {...r} last={i === columns[0].length - 1} />)}
                        </div>
                        <div className="relative my-1" style={{ background: `linear-gradient(${'#E3EAF6'}, ${GOLD_LIGHT}, ${'#E3EAF6'})` }}>
                            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45" style={{ background: GOLD }} />
                        </div>
                        <div>
                            {columns[1].map((r, i) => <Row key={r.label} {...r} last={i === columns[1].length - 1} />)}
                        </div>
                    </div>
                )}

                <Rules width="w-[190px]" className="relative z-10 mt-[7px]">
                    <p className="text-[14px] font-bold uppercase tracking-[0.34em]" style={{ color: NAVY_MID }}>
                        Together <span style={{ color: GOLD }}>•</span> Trade <span style={{ color: GOLD }}>•</span> Grow
                    </p>
                </Rules>

                {/* ============================================ signature · seal · date */}
                <div className="absolute left-[230px] top-[630px] z-10 w-[230px] text-center">
                    <p className="text-[16px] font-bold" style={{ color: NAVY }}>Founder President</p>
                    <SignatureInk className="h-[60px]" />
                    <span className="mt-0.5 block h-px w-full" style={{ background: NAVY_MID }} />
                </div>

                <div className="absolute left-1/2 top-[606px] z-20 flex -translate-x-1/2 flex-col items-center">
                    <CertificateMedallion line="Membership" className="h-[128px] w-[128px]" />
                    <p className="mt-0.5 text-[14px] font-semibold" style={{ color: NAVY }}>Official Seal</p>
                </div>

                <div className="absolute right-[250px] top-[630px] z-10 w-[230px] text-center">
                    <p className="text-[16px] font-bold" style={{ color: NAVY }}>Date of Issue</p>
                    <p className="flex h-[56px] items-end justify-center pb-1 font-certificate text-[26px] font-bold" style={{ color: NAVY_MID }}>
                        {issued || '—'}
                    </p>
                    <span className="mt-0.5 block h-px w-full" style={{ background: NAVY_MID }} />
                </div>

                {/* ============================================ the foot bars */}
                {/* Held inside the left bar and clear of the seal: the bar ends at
                    x=500 and the medallion starts at ~497, so the line is capped at
                    410px and never runs under it. */}
                <p className="absolute left-[40px] top-[730px] z-10 flex h-[46px] max-w-[410px] items-center gap-2 whitespace-nowrap text-[13.5px] font-medium text-white">
                    <FileText className="h-[17px] w-[17px] shrink-0" style={{ color: GOLD_LIGHT }} />
                    Certificate No: <span className="font-bold tracking-[0.03em]">{cert.reference || '—'}</span>
                </p>
                <div className="absolute right-[36px] top-[730px] z-10 flex h-[46px] items-center gap-2.5 text-white">
                    <Globe className="h-[20px] w-[20px]" style={{ color: GOLD_LIGHT }} />
                    <div className="leading-tight">
                        <p className="text-[12.5px]"><span className="font-bold">Issued by:</span> ACTIV <span className="mx-1 opacity-60">|</span> Chennai, Tamil Nadu</p>
                        <p className="text-[12.5px] opacity-90">www.activ.org.in</p>
                    </div>
                </div>
            </div>
        </CertificateSheet>
    );
}
