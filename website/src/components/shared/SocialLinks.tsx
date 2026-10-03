import { useEffect, useState } from 'react';
import type { IconType } from 'react-icons';
import {
    FaFacebookF, FaInstagram, FaXTwitter, FaLinkedinIn, FaYoutube, FaWhatsapp, FaTelegram, FaThreads,
} from 'react-icons/fa6';
import { getContactInfo, getSiteSettings, SOCIAL_PLATFORMS, type SocialPlatform } from '@/services/cmsApi';

/**
 * THE ASSOCIATION'S SOCIAL BUTTONS — footer, Contact page, phone menu.
 *
 * One source: CMS → Contact → Social media (`contact.social`), where each link
 * is normalised by the server ("@activ" / "instagram.com/x" → a real https URL,
 * a WhatsApp number → wa.me). The footer's older free-form social rows are
 * still honoured for anything the Contact list does not have, so nothing an
 * editor already set up disappears — but they too are made absolute here: a
 * pasted "facebook.com/activ" used to become a link to activ.org.in/facebook.com/…
 */

export const SOCIAL_META: Record<SocialPlatform, { label: string; icon: IconType; brand: string }> = {
    facebook: { label: 'Facebook', icon: FaFacebookF, brand: '#1877F2' },
    instagram: { label: 'Instagram', icon: FaInstagram, brand: '#E4405F' },
    x: { label: 'X (Twitter)', icon: FaXTwitter, brand: '#0F1419' },
    linkedin: { label: 'LinkedIn', icon: FaLinkedinIn, brand: '#0A66C2' },
    youtube: { label: 'YouTube', icon: FaYoutube, brand: '#FF0000' },
    whatsapp: { label: 'WhatsApp', icon: FaWhatsapp, brand: '#25D366' },
    telegram: { label: 'Telegram', icon: FaTelegram, brand: '#229ED9' },
    threads: { label: 'Threads', icon: FaThreads, brand: '#101010' },
};

/** Which platform a URL (or a footer row's icon name) belongs to. */
export const platformOf = (href: string, iconName = ''): SocialPlatform | null => {
    const name = iconName.toLowerCase();
    if (name === 'twitter') return 'x';
    if ((SOCIAL_PLATFORMS as readonly string[]).includes(name)) return name as SocialPlatform;
    const h = href.toLowerCase();
    if (/facebook\.com|fb\.com/.test(h)) return 'facebook';
    if (/instagram\.com/.test(h)) return 'instagram';
    if (/(twitter|x)\.com/.test(h)) return 'x';
    if (/linkedin\.com/.test(h)) return 'linkedin';
    if (/youtube\.com|youtu\.be/.test(h)) return 'youtube';
    if (/wa\.me|whatsapp\.com/.test(h)) return 'whatsapp';
    if (/t\.me|telegram\./.test(h)) return 'telegram';
    if (/threads\.(net|com)/.test(h)) return 'threads';
    return null;
};

/** A link as the browser must see it: absolute https, or nothing. */
export const absoluteUrl = (href?: string) => {
    const v = (href || '').trim();
    if (!v || v.startsWith('#')) return '';
    if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return /^https?:/i.test(v) ? v : '';
    return `https://${v.replace(/^\/+/, '')}`;
};

/* The profile URL an "@handle" (or a bare name) stands for — the browser's copy
   of `SOCIAL_BASE` in backend `cms/contactOffices.js`; keep the two in step. */
const HANDLE_BASE: Partial<Record<SocialPlatform, string>> = {
    facebook: 'https://www.facebook.com/',
    instagram: 'https://www.instagram.com/',
    x: 'https://x.com/',
    linkedin: 'https://www.linkedin.com/company/',
    youtube: 'https://www.youtube.com/@',
    telegram: 'https://t.me/',
    threads: 'https://www.threads.com/@',
};

/** One platform's link as the browser must open it — handle, bare domain or full URL. */
export const socialHref = (platform: SocialPlatform, value?: string) => {
    const v = (value || '').trim();
    if (!v) return '';
    const isHandle = /^@[A-Za-z0-9._-]+$/.test(v) || /^[A-Za-z0-9_-]+$/.test(v);
    const base = HANDLE_BASE[platform];
    if (isHandle && base) return `${base}${v.replace(/^@/, '')}`;
    return absoluteUrl(v);
};

/**
 * THREADS FOLLOWS INSTAGRAM when it has no link of its own.
 *
 * A Threads profile is an Instagram account under the same username, so the
 * association's Threads address is knowable from its Instagram one. Without
 * this the footer, the Contact page and the phone menu showed every network
 * but Threads simply because nobody had pasted the second copy of the handle.
 * An explicit Threads link always wins.
 */
export const withThreads = (byPlatform: Map<SocialPlatform, string>) => {
    if (byPlatform.has('threads')) return byPlatform;
    const handle = /instagram\.com\/([A-Za-z0-9._]+)/i.exec(byPlatform.get('instagram') || '')?.[1] || '';
    if (handle && !['p', 'reel', 'reels', 'explore', 'stories'].includes(handle.toLowerCase())) {
        byPlatform.set('threads', `https://www.threads.com/@${handle}`);
    }
    return byPlatform;
};

export type SocialLink = { platform: SocialPlatform; href: string };

/** The live list, in the fixed platform order, one per platform. */
export function useSocialLinks(): SocialLink[] {
    const [links, setLinks] = useState<SocialLink[]>([]);
    useEffect(() => {
        let cancelled = false;
        Promise.allSettled([getContactInfo(), getSiteSettings()]).then(([c, s]) => {
            if (cancelled) return;
            const byPlatform = new Map<SocialPlatform, string>();
            const social = c.status === 'fulfilled' ? (c.value?.social || {}) as Record<string, string> : {};
            for (const p of SOCIAL_PLATFORMS) {
                const href = socialHref(p, social[p]);
                if (href) byPlatform.set(p, href);
            }
            const rows = s.status === 'fulfilled' ? (s.value?.footer?.socials || []) : [];
            for (const row of rows) {
                const href = absoluteUrl(row?.href);
                const p = href ? platformOf(href, row?.icon || '') : null;
                if (p && !byPlatform.has(p)) byPlatform.set(p, href);
            }
            withThreads(byPlatform);
            setLinks(SOCIAL_PLATFORMS.filter((p) => byPlatform.has(p)).map((p) => ({ platform: p, href: byPlatform.get(p) as string })));
        });
        return () => { cancelled = true; };
    }, []);
    return links;
}

/**
 * The row of round buttons.
 *   tone="dark"  — on the navy footer / drawer (white glass, brand colour on hover)
 *   tone="light" — on a white card (brand-coloured discs)
 */
export function SocialButtons({
    links, tone = 'light', size = 'md', className = '',
}: { links: SocialLink[]; tone?: 'light' | 'dark'; size?: 'sm' | 'md'; className?: string }) {
    if (!links.length) return null;
    const box = size === 'sm' ? 'h-10 w-10' : 'h-11 w-11';
    const glyph = size === 'sm' ? 15 : 17;
    return (
        <ul className={`flex flex-wrap items-center gap-2.5 ${className}`}>
            {links.map(({ platform, href }) => {
                const meta = SOCIAL_META[platform];
                const Icon = meta.icon;
                const label = platform === 'whatsapp' && href.includes('/channel/') ? 'WhatsApp channel' : meta.label;
                return (
                    <li key={platform}>
                        <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`ACTIV on ${label}`}
                            title={label}
                            style={tone === 'light' ? { backgroundColor: meta.brand } : undefined}
                            className={`group grid ${box} place-items-center rounded-full transition-all duration-200 hover:-translate-y-0.5
                                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${tone === 'dark'
                                ? 'bg-white/10 text-white ring-1 ring-white/15 hover:bg-white hover:text-brand-800 focus-visible:ring-white'
                                : 'text-white shadow-md hover:shadow-lg hover:brightness-110 focus-visible:ring-brand-600'}`}
                        >
                            <Icon size={glyph} aria-hidden="true" />
                        </a>
                    </li>
                );
            })}
        </ul>
    );
}

/** Convenience: the live links, drawn. Renders nothing when none are set. */
export default function SocialLinks(props: { tone?: 'light' | 'dark'; size?: 'sm' | 'md'; className?: string }) {
    const links = useSocialLinks();
    return <SocialButtons links={links} {...props} />;
}
