import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';

/**
 * THE "CHAT WITH US" BUTTON — opens the BotBee bot on WhatsApp.
 *
 * The chat used to be Brevo's widget. It is now ACTIV's own WhatsApp number,
 * +91 82201 12188 ("ACTIV India"), which BotBee answers: the same bot that
 * replies to STATUS / HELP / EVENTS (`botbeeWebhook.service`), so a visitor
 * reaches one inbox whichever way they write. On a phone it opens the WhatsApp
 * app; on a desktop, WhatsApp Web.
 *
 * `VITE_CHAT_WHATSAPP` overrides the number (digits, country code first).
 *
 * Hidden in the CMS and the admin portals, where it only got in the way.
 */
const CHAT_NUMBER = String(import.meta.env.VITE_CHAT_WHATSAPP || '918220112188').replace(/\D/g, '');
const CHAT_URL = `https://wa.me/${CHAT_NUMBER}?text=${encodeURIComponent('Hi ACTIV')}`;
const KEY = 'activ-chat-launcher';
// Admin screens, and checkout — where it sat on top of the Pay button.
const HIDDEN_ON = /^\/(cms|super-admin|state-admin|district-admin|block-admin|events-admin|admin|payment|member\/payment)(\/|$)/;

export function ChatLauncher() {
    const { pathname } = useLocation();
    const [closed, setClosed] = useState(() => {
        try { return sessionStorage.getItem('activ-chat-closed') === 'true'; } catch { return false; }
    });

    if (closed) return null;

    return (
        <div
            className={`fixed z-[70] right-4 sm:right-6 bottom-6 transition-all duration-300 ease-in-out ${HIDDEN_ON.test(pathname) ? 'hidden' : ''}`}
        >
            <button
            type="button"
            aria-label="Message us"
            onClick={() => { 
                const botbeeBtn = document.querySelector('.xit-widget-bswc-button') as HTMLElement;
                if (botbeeBtn) {
                    botbeeBtn.click();
                } else if ((window as any).toggleModalBSWC) {
                    (window as any).toggleModalBSWC();
                } else {
                    alert('Chat is still loading, please wait a moment!');
                }
            }}
            style={{ backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)' }}
            className={`activ-chat-launcher select-none
                        inline-flex items-center gap-2 rounded-full text-white
                        h-14 w-14 sm:w-auto sm:h-12 sm:px-5 justify-center
                        shadow-lg ring-1 ring-white/20
                        transition-transform duration-200 hover:scale-105
                        active:scale-95 cursor-pointer`}
        >
            <span className="relative grid place-items-center">
                <MessageCircle className="h-6 w-6 sm:h-5 sm:w-5" />
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#1c2e68]" />
            </span>
            <span className="hidden sm:inline text-[0.95rem] font-semibold">Chat with us</span>
        </button>
        <button
            onClick={(e) => {
                e.stopPropagation();
                setClosed(true);
                try { sessionStorage.setItem('activ-chat-closed', 'true'); } catch { /* private window */ }
            }}
            aria-label="Close chat button"
            className="absolute -top-2 -right-2 bg-white text-gray-700 hover:text-red-600 rounded-full shadow-md p-1.5 border border-gray-200 z-10 transition-colors"
        >
            <X className="w-3.5 h-3.5" />
        </button>
        </div>
    );
}

export default ChatLauncher;
