import { useEffect, useRef, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { MessageCircle, X, GripVertical, HeartHandshake, Smartphone } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { ACTIV_PLAY_STORE_URL, insideActivApp } from '@/components/shared/AppDownloadPromotion';

/**
 * THE FLOATING BUTTONS — two independent, movable groups.
 *
 *   1. WhatsApp + "Chat with us" (BotBee webchat), one stack, right side by default.
 *   2. GET THE APP + DONATE, separate buttons in a left-side group so they
 *      stay apart from the two support buttons.
 *
 * - DRAG either group anywhere (mouse or finger, by its grip or its buttons).
 *   On release it snaps to the nearer side; each group's spot is remembered
 *   per browser under its own key. A drag never opens anything — only a tap.
 * - Every button has the same ✕. Closing hides it for this browser session.
 * - Hidden in the CMS, the admin portals and checkout, where they covered
 *   buttons; Donate is also hidden on the donation pages themselves.
 *
 * Webchat: the BotBee widget script (index.html) is opened through its own
 * button / `toggleModalBSWC`. WhatsApp: ACTIV's number, which BotBee answers.
 * `VITE_CHAT_WHATSAPP` overrides the number (digits, country code first).
 *
 * The drag logic is a module-level hook used twice — never a component
 * declared inside another component.
 */
const CHAT_NUMBER = String(import.meta.env.VITE_CHAT_WHATSAPP || '918220112188').replace(/\D/g, '');
const WHATSAPP_URL = `https://wa.me/${CHAT_NUMBER}?text=${encodeURIComponent('Hi ACTIV')}`;
const SUPPORT_SPOT_KEY = 'activ-launchers-spot';
const DONATE_SPOT_KEY = 'activ-donate-spot';
const HIDDEN_ON = /^\/(cms|super-admin|state-admin|district-admin|block-admin|events-admin|admin|payment|member\/payment|donate\/receipt|donate\/statement|auth|login|register|forgot-password|reset-password)(\/|$)/;
/** Donate is a PUBLIC-site call to action: not on the donation pages themselves,
    and not over the signed-in member / business work screens, where it covered
    their own primary buttons. */
const DONATE_HIDDEN_ON = /^\/(donate|member|business)(\/|$)/;

type Spot = { side: 'left' | 'right'; y: number };

const readSpot = (key: string, fallback: Spot): Spot => {
    try {
        const raw = JSON.parse(localStorage.getItem(key) || 'null');
        if (raw && (raw.side === 'left' || raw.side === 'right') && Number.isFinite(raw.y)) return raw;
    } catch { /* default */ }
    return fallback;
};
const readClosed = (key: string) => { try { return sessionStorage.getItem(key) === 'true'; } catch { return false; } };
const writeClosed = (key: string) => { try { sessionStorage.setItem(key, 'true'); } catch { /* private window */ } };

const openWebchat = () => {
    const botbeeBtn = document.querySelector('.xit-widget-bswc-button') as HTMLElement | null;
    if (botbeeBtn) botbeeBtn.click();
    else if ((window as any).toggleModalBSWC) (window as any).toggleModalBSWC();
    else window.open(WHATSAPP_URL, '_blank', 'noopener');   // widget not loaded yet: WhatsApp reaches the same bot
};

/**
 * Drag-to-move for one floating group: pointer handlers, the position style,
 * and a ref whose clicks are swallowed after a drag.
 */
function useFloatingDrag(spotKey: string, fallback: Spot) {
    const [spot, setSpot] = useState<Spot>(() => readSpot(spotKey, fallback));
    const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
    const start = useRef<{ px: number; py: number; moved: boolean } | null>(null);
    const box = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        try { localStorage.setItem(spotKey, JSON.stringify(spot)); } catch { /* private window */ }
    }, [spot, spotKey]);

    // A drag must never reach a button as a click.
    useEffect(() => {
        const el = box.current;
        if (!el) return undefined;
        const swallow = (e: MouseEvent) => {
            if (start.current?.moved) { e.stopImmediatePropagation(); e.preventDefault(); }
            start.current = null;
        };
        el.addEventListener('click', swallow, true);
        return () => el.removeEventListener('click', swallow, true);
    });

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        // No pointer capture on press: that would retarget a plain tap to the
        // container. Capture only once a real drag has started.
        start.current = { px: e.clientX, py: e.clientY, moved: false };
    };
    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        const s = start.current;
        if (!s) return;
        if (!s.moved && Math.hypot(e.clientX - s.px, e.clientY - s.py) < 6) return;
        if (!s.moved) {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already released */ }
        }
        s.moved = true;
        setDrag({ x: e.clientX, y: e.clientY });
    };
    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!start.current?.moved) { start.current = null; return; }   // a tap: let the click through
        const h = window.innerHeight || 1;
        setSpot({
            side: e.clientX < (window.innerWidth || 1) / 2 ? 'left' : 'right',
            y: Math.min(0.9, Math.max(0.15, e.clientY / h)),
        });
        setDrag(null);
    };

    const style: React.CSSProperties = drag
        ? { left: drag.x, top: drag.y, transform: 'translate(-50%, -50%)', transition: 'none' }
        : { [spot.side]: 16, top: `${spot.y * 100}%`, transform: 'translateY(-50%)' };

    const className = `fixed z-[45] flex touch-none flex-col gap-3 ${spot.side === 'left' ? 'items-start' : 'items-end'}
                       ${drag ? 'cursor-grabbing' : 'cursor-grab'} transition-[top,left,right] duration-300`;

    return { box, style, className, handlers: { onPointerDown, onPointerMove, onPointerUp } };
}

function CloseDot({ label, onClose }: { label: string; onClose: () => void }) {
    return (
        <button
            type="button"
            aria-label={label}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClose(); }}
            className="absolute -top-2 -right-2 z-10 grid h-6 w-6 place-items-center rounded-full border border-gray-200 bg-white
                       text-gray-600 shadow-md transition-colors hover:text-red-600"
        >
            <X className="h-3.5 w-3.5" />
        </button>
    );
}

function Grip() {
    return (
        <span aria-hidden="true" title="Drag to move"
            className="grid h-6 w-10 place-items-center self-center rounded-full bg-white/90 text-gray-400 shadow ring-1 ring-gray-200">
            <GripVertical className="h-4 w-4 rotate-90" />
        </span>
    );
}

const PILL = `relative inline-flex select-none items-center justify-center gap-2 rounded-full text-white shadow-lg ring-1 ring-white/20
              h-14 w-14 sm:h-12 sm:w-auto sm:px-5 transition-transform duration-200 hover:scale-105 active:scale-95`;

/** Bigger than the support pills: it is the one call to action here. */
const DONATE_PILL = `relative inline-flex select-none items-center justify-center gap-2.5 rounded-full text-white
                     shadow-[0_14px_30px_-10px_rgba(180,83,9,0.75)] ring-2 ring-white/40
                     h-16 w-16 sm:h-14 sm:w-auto sm:px-7 transition-transform duration-200 hover:scale-105 active:scale-95`;

export default function FloatingLaunchers() {
    const { pathname } = useLocation();
    const [chatClosed, setChatClosed] = useState(() => readClosed('activ-chat-closed'));
    const [waClosed, setWaClosed] = useState(() => readClosed('activ-whatsapp-closed'));
    const [donateClosed, setDonateClosed] = useState(() => readClosed('activ-donate-closed'));
    const [appClosed, setAppClosed] = useState(() => readClosed('activ-download-closed'));

    const support = useFloatingDrag(SUPPORT_SPOT_KEY, { side: 'right', y: 0.82 });
    const donate = useFloatingDrag(DONATE_SPOT_KEY, { side: 'left', y: 0.82 });

    if (HIDDEN_ON.test(pathname)) return null;
    const showSupport = !(chatClosed && waClosed);
    const showDonate = !donateClosed && !DONATE_HIDDEN_ON.test(pathname);
    const showApp = !appClosed && !insideActivApp();

    return (
        <>
            {showDonate || showApp ? (
                <div ref={donate.box} style={donate.style} {...donate.handlers} className={donate.className}>
                    <Grip />
                    {showApp && <div className="relative">
                        <a href={ACTIV_PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
                            aria-label="Get the ACTIV app on Google Play" draggable={false}
                            className="activ-app-launcher relative inline-flex h-12 select-none items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[#14265b] to-[#2563eb] px-4 text-white shadow-lg ring-1 ring-white/30 transition-transform hover:scale-105 active:scale-95 sm:px-5">
                            <Smartphone className="h-5 w-5" aria-hidden="true" />
                            <span className="text-sm font-bold sm:text-[0.95rem]">Get the app</span>
                        </a>
                        <CloseDot label="Close app download button" onClose={() => { setAppClosed(true); writeClosed('activ-download-closed'); }} />
                    </div>}
                    {showDonate && <div className="relative">
                        <Link
                            to="/donate"
                            aria-label="Donate to ACTIV"
                            style={{ backgroundImage: 'linear-gradient(135deg, #b45309 0%, #f59e0b 100%)' }}
                            className={DONATE_PILL}
                            draggable={false}
                        >
                            <HeartHandshake className="h-7 w-7 sm:h-6 sm:w-6" aria-hidden="true" />
                            <span className="hidden text-[1.0625rem] font-bold tracking-wide sm:inline">Donate</span>
                        </Link>
                        <CloseDot label="Close donate button" onClose={() => { setDonateClosed(true); writeClosed('activ-donate-closed'); }} />
                    </div>}
                </div>
            ) : null}

            {showSupport ? (
                // Below the BotBee chat panel, so the open chat is never covered.
                <div ref={support.box} style={support.style} {...support.handlers} className={support.className}>
                    <Grip />

                    {!waClosed ? (
                        <div className="relative">
                            <a
                                href={WHATSAPP_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Chat on WhatsApp"
                                style={{ backgroundColor: '#25D366' }}
                                className={PILL}
                                draggable={false}
                            >
                                <FaWhatsapp className="h-7 w-7 sm:h-6 sm:w-6" aria-hidden="true" />
                                <span className="hidden text-[0.95rem] font-semibold sm:inline">WhatsApp</span>
                            </a>
                            <CloseDot label="Close WhatsApp button" onClose={() => { setWaClosed(true); writeClosed('activ-whatsapp-closed'); }} />
                        </div>
                    ) : null}

                    {!chatClosed ? (
                        <div className="relative">
                            <button
                                type="button"
                                aria-label="Chat with us"
                                onClick={openWebchat}
                                style={{ backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' }}
                                className={`activ-chat-launcher ${PILL}`}
                            >
                                <span className="relative grid place-items-center">
                                    <MessageCircle className="h-6 w-6 sm:h-5 sm:w-5" />
                                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1c2e68]" />
                                </span>
                                <span className="hidden text-[0.95rem] font-semibold sm:inline">Chat with us</span>
                            </button>
                            <CloseDot label="Close chat button" onClose={() => { setChatClosed(true); writeClosed('activ-chat-closed'); }} />
                        </div>
                    ) : null}
                </div>
            ) : null}
        </>
    );
}
