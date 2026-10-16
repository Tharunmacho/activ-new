import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';

const CHAT_NUMBER = String(import.meta.env.VITE_CHAT_WHATSAPP || '918220112188').replace(/\D/g, '');
const CHAT_URL = `https://wa.me/${CHAT_NUMBER}?text=${encodeURIComponent('Hi ACTIV')}`;
const KEY = 'activ-whatsapp-launcher';
// Admin screens, and checkout — where it sat on top of the Pay button.
const HIDDEN_ON = /^\/(cms|super-admin|state-admin|district-admin|block-admin|events-admin|admin|payment|member\/payment)(\/|$)/;

export function WhatsAppLauncher() {
    const { pathname } = useLocation();
    const [closed, setClosed] = useState(() => {
        try { return sessionStorage.getItem('activ-whatsapp-closed') === 'true'; } catch { return false; }
    });

    if (closed) return null;

    return (
        <div
            className={`fixed z-[70] right-4 sm:right-6 bottom-[5.5rem] sm:bottom-[5rem] transition-all duration-300 ease-in-out ${HIDDEN_ON.test(pathname) ? 'hidden' : ''}`}
        >
            <a
            href={CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Chat on WhatsApp"
            style={{ backgroundColor: '#25D366' }}
            className={`activ-chat-launcher select-none
                        inline-flex items-center gap-2 rounded-full text-white
                        h-14 w-14 sm:w-auto sm:h-12 sm:px-5 justify-center
                        shadow-lg ring-1 ring-white/20
                        transition-transform duration-200 hover:scale-105
                        active:scale-95 cursor-pointer`}
        >
            <span className="relative grid place-items-center">
                <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 sm:h-5 sm:w-5">
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
            </span>
            <span className="hidden sm:inline text-[0.95rem] font-semibold">WhatsApp</span>
        </a>
        <button
            onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setClosed(true);
                try { sessionStorage.setItem('activ-whatsapp-closed', 'true'); } catch { /* private window */ }
            }}
            aria-label="Close WhatsApp button"
            className="absolute -top-2 -right-2 bg-white text-gray-700 hover:text-red-600 rounded-full shadow-md p-1.5 border border-gray-200 z-10 transition-colors"
        >
            <X className="w-3.5 h-3.5" />
        </button>
        </div>
    );
}

export default WhatsAppLauncher;
