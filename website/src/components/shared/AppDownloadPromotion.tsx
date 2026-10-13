import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, CreditCard, Megaphone, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import './appDownloadPromotion.css';

export const ACTIV_PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=in.activ.membership';
const insideApp = () => typeof window !== 'undefined' && (
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

/** A small discovery link; never interrupts sign-in, booking or payment. */
export function AppDownloadStrip() {
    if (insideApp()) return null;
    return <a className="activ-app-strip" href={ACTIV_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
        aria-label="Download the ACTIV Android app on Google Play">
        <Smartphone size={16} aria-hidden="true" />
        <span>ACTIV is now on Android</span><strong>Get the app <ArrowUpRight size={15} /></strong>
    </a>;
}

export default function AppDownloadPromotion({ member = false }: { member?: boolean }) {
    const [qr, setQr] = useState('');
    const hidden = insideApp();
    useEffect(() => {
        if (hidden) return;
        let active = true;
        QRCode.toDataURL(ACTIV_PLAY_STORE_URL, { width: 160, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#14265b', light: '#ffffff' } })
            .then(value => { if (active) setQr(value); }).catch(() => {});
        return () => { active = false; };
    }, [hidden]);
    if (hidden) return null;
    return <section className="activ-app-promo" aria-label="Get the ACTIV mobile app">
        <div className="activ-app-promo__copy">
            <span className="activ-app-promo__eyebrow"><Smartphone size={16} /> THE ACTIV APP</span>
            <h2>Your community.<br /><span>Always with you.</span></h2>
            <p>{member ? 'Your ACTIV membership, ready when you need it. Sign in with the same account on the app.' : 'Discover ACTIV, find your next event and stay close to your community. Now on Android.'}</p>
            <ul className="activ-app-promo__features">
                <li><CalendarDays size={17} /> Book events</li>
                <li><CreditCard size={17} /> Membership in your pocket</li>
                <li><Megaphone size={17} /> Association updates</li>
            </ul>
            <div className="activ-app-promo__actions">
                <a className="activ-play-button" href={ACTIV_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" aria-label="Get ACTIV on Google Play">
                    <PlayMark /><span><small>GET IT ON</small><strong>Google Play</strong></span><ArrowUpRight size={20} />
                </a>
                <span className="activ-app-promo__hint">{member ? 'One account. Website and app.' : 'Explore first. Join when you’re ready.'}</span>
            </div>
        </div>
        <div className="activ-app-promo__visual" aria-hidden="true">
            <div className="activ-app-phone">
                <div className="activ-app-phone__top"><img src="/logo_ACTIVian-removebg-preview.png" alt="" /><span>Welcome to ACTIV</span><strong>Discover. Connect. Grow.</strong></div>
                <div className="activ-app-phone__body">
                    <div className="activ-app-phone__event"><CalendarDays size={26} /><span><strong>Your next opportunity</strong><small>Explore upcoming events</small></span><ArrowUpRight size={18} /></div>
                    <div className="activ-app-phone__tiles"><span><CreditCard />Membership</span><span><Megaphone />Updates</span></div>
                    <div className="activ-app-phone__line" /><div className="activ-app-phone__line is-short" />
                </div>
            </div>
        </div>
        {qr && <div className="activ-app-promo__qr"><img src={qr} width="128" height="128" alt="QR code linking to ACTIV on Google Play" /><span>Scan to get the app</span></div>}
    </section>;
}
