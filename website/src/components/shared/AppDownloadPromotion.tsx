import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowUpRight, CalendarDays, CreditCard, House, Images, MapPin, Megaphone, Newspaper, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import './appDownloadPromotion.css';

export const ACTIV_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=in.activ.membership';
export const insideActivApp = () => typeof window !== 'undefined' && (
    !!(window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView ||
    new URLSearchParams(window.location.search).has('activApp')
);

function PlayMark() {
    return <svg viewBox="0 0 24 26" width="25" height="28" aria-hidden="true">
        <path fill="#35c5ef" d="M1 1 14 13 1 25Z" />
        <path fill="#55dc88" d="m1 1 16 9-3 3Z" />
        <path fill="#ffce4f" d="m17 10 6 3-6 3-3-3Z" />
        <path fill="#ff6878" d="m1 25 13-12 3 3Z" />
    </svg>;
}

export default function AppDownloadPromotion({ member = false }: { member?: boolean }) {
    const [qr, setQr] = useState('');
    const [preview, setPreview] = useState(0);
    const screens = [
        { label: 'Home', icon: House, src: '/app/activ-android-home.png', alt: 'ACTIV Android Home screen with upcoming event banners and community highlights', caption: 'Your community, events and opportunities. All in one app.' },
        { label: 'Events', icon: CalendarDays, src: '/app/activ-android-events.png', alt: 'ACTIV Android Events screen with upcoming programmes and event search', caption: 'Find your next opportunity. Discover and book ACTIV events.' },
        { label: 'Gallery', icon: Images, src: '/app/activ-android-gallery.png', alt: 'ACTIV Android Gallery screen showing photographs from community events', caption: 'See the people, moments and connections that bring ACTIV together.' },
        { label: 'News', icon: Newspaper, src: '/app/activ-android-news.png', alt: 'ACTIV Android News screen with association news and announcements', caption: 'Stay connected to the latest news from the ACTIV community.' },
        { label: 'Zones', icon: MapPin, src: '/app/activ-android-zones.png', alt: 'ACTIV Android Zones screen with national and regional updates', caption: 'Explore your region. Connect with ACTIV closer to home.' },
    ];
    const hidden = insideActivApp();
    useEffect(() => {
        if (hidden) return;
        let active = true;
        QRCode.toDataURL(ACTIV_PLAY_STORE_URL, { width: 416, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#14265b', light: '#ffffff' } })
            .then(value => { if (active) setQr(value); }).catch(() => {});
        return () => { active = false; };
    }, [hidden]);
    if (hidden) return null;
    return <section className="activ-app-promo-shell font-sans" aria-label="Get the ACTIV mobile app"><div className="activ-app-promo">
        <div className="activ-app-promo__copy">
            <span className="activ-app-promo__eyebrow"><Smartphone size={16} /> ACTIV FOR ANDROID</span>
            <h2>Your community.<br /><span>Always with you.</span></h2>
            <p>{member ? 'Your ACTIV membership, ready when you need it. Sign in with the same account on the app.' : 'Discover ACTIV, find your next event and stay close to your community. Now on Android.'}</p>
            <ul className="activ-app-promo__features">
                <li><CalendarDays size={17} /> Book events</li>
                <li><CreditCard size={17} /> Membership in your pocket</li>
                <li><Megaphone size={17} /> Association updates</li>
            </ul>
        </div>
        <div className="activ-app-promo__visual">
            <div className="activ-app-promo__screens" aria-label="A look inside the ACTIV app">
                {screens.map((screen, index) => {
                    const distance = (index - preview + screens.length) % screens.length;
                    const position = distance > Math.floor(screens.length / 2) ? distance - screens.length : distance;
                    return <button className="activ-app-promo__screen" key={screen.src} type="button"
                        data-position={position} style={{ '--position': position } as CSSProperties}
                        aria-label={`Preview ${screen.label}`} aria-pressed={preview === index} onClick={() => setPreview(index)}>
                        <span className="activ-app-phone"><img src={screen.src} width="945" height="2048" loading="lazy" decoding="async" alt={screen.alt} /></span>
                    </button>;
                })}
            </div>
            <div className="activ-app-promo__switcher" aria-label="Choose an app screen">
                {screens.map((screen, index) => <button type="button" key={screen.src} aria-pressed={preview === index} onClick={() => setPreview(index)}><screen.icon size={15} aria-hidden="true" />{screen.label}</button>)}
            </div>
            <p className="activ-app-promo__caption" aria-live="polite">{screens[preview].caption}</p>
        </div>
        <div className="activ-app-promo__download">
            <div className="activ-app-promo__actions">
                <a className="activ-play-button" href={ACTIV_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Get ACTIV on Google Play">
                    <PlayMark /><span><small>GET IT ON</small><strong>Google Play</strong></span><ArrowUpRight size={20} />
                </a>
                <span className="activ-app-promo__hint">{member ? 'One account. Website and app.' : 'Explore first. Join when you’re ready.'}</span>
            </div>
            {qr && <a className="activ-app-promo__qr" href={ACTIV_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Scan or open ACTIV on Google Play">
                <img src={qr} width="208" height="208" alt="QR code linking to ACTIV on Google Play" />
                <span>Scan to download</span>
            </a>}
        </div>
    </div></section>;
}
