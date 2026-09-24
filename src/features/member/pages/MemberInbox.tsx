import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Inbox, Send, ArrowLeft, Loader2, AlertCircle, ImagePlus, Smile, X,
} from 'lucide-react';
import { resolveMediaUrl } from '@/config/api.config';

/**
 * ============================================================================
 * HOW A MEMBER OPENS A CONVERSATION
 * ============================================================================
 *
 * The association asked for the same treatment the leader enquiry form got:
 * no “hi” and no “bye” — a first message about business.
 *
 * That form answered it by removing the free box entirely: the visitor picks
 * a purpose and the SERVER composes the sentence. It cannot be repeated here,
 * and the difference is the reason. A leader enquiry is one message to a
 * stranger who will reply by telephone; this is a conversation between two
 * members who will exchange dozens. A fixed list would make the second reply
 * impossible to write.
 *
 * So the openers are OFFERED rather than imposed. Each names a reason two
 * member businesses actually talk, and pressing one fills the box — it never
 * sends. A message that leaves the instant a chip is pressed is a message
 * nobody read before it went.
 *
 * `{name}` is replaced with the other member's first name.
 */
const OPENERS: { label: string; hint: string; text: string }[] = [
    {
        label: 'Supply enquiry',
        hint: 'You are looking for a supplier and want to know what they make.',
        text: 'Hello {name}, I am an ACTIV member and I am looking for a supplier '
            + 'for our line. Could you tell me what you currently manufacture or trade in?',
    },
    {
        label: 'Ask for a quotation',
        hint: 'You know what you need and want a price for it.',
        text: 'Hello {name}, I would like a quotation for one of your products. '
            + 'May I send you the specification and the quantity we need?',
    },
    {
        label: 'Work together on an order',
        hint: 'An order larger than your own capacity, shared with a member.',
        text: 'Hello {name}, we have an order that is larger than our own capacity '
            + 'and I am looking for an ACTIV member to take part of it. Would that be '
            + 'of interest?',
    },
];

/**
 * The marks that belong in a business conversation, and no more than that.
 *
 * A curated grid rather than a picker library: a full emoji keyboard is
 * 1,800 characters and a megabyte of data behind a button somebody presses to
 * say “yes”. These are the acknowledgements, the yes and the no, the goods,
 * the money and the calendar — what two members actually reach for.
 */
const EMOJI = [
    '👍', '👏', '🙏', '✅', '❌', '❗', '❓', '👀',
    '😊', '🙂', '😅', '😢', '🎉', '🔥', '💯', '⭐',
    '📦', '🚚', '🏭', '🛍️', '💰', '📈', '📄', '📎',
    '📞', '📲', '📅', '⏰', '📍', '🤝', '🤝', '📧',
];
import { EmptyState } from '@/features/member/components/MemberUI';
import { errorMessage } from '@/services/activApi';
import {
    listConversations, listMessages, sendMessage, uploadMessageImage, markConversationRead,
    type Conversation, type DirectMessage,
} from '@/services/messagesApi';

/**
 * The working inbox, for a member whose membership is active.
 *
 * Split out of `MemberMessages` so that file stays what it is: the decision
 * about whether this member may use messaging at all, and the offer that
 * resolves it when they may not. This component is only ever rendered on the
 * paid side of that branch.
 *
 * ==========================================================================
 * POLLING, NOT SOCKETS
 * ==========================================================================
 *
 * There is no websocket anywhere in this product and adding one for this would
 * mean a second transport, a second auth path and a second thing to keep alive
 * behind whatever proxies the association ends up running. Ten seconds is well
 * inside what a member reads as "it arrived", and the two requests it makes are
 * both indexed single-key lookups.
 *
 * The poll stops while the tab is hidden. A background tab that keeps asking is
 * the reason "this site drains my battery" — and nobody is reading it.
 */

const timeOf = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';

    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
        ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
        : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

const initialsOf = (name: string) =>
    (name || '').split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'M';

/**
 * A SENTENCE A MEMBER CAN ACT ON — never the server's own words.
 *
 * `errorMessage` returns whatever the API said, which is right for a validation
 * failure the member caused ("that message is too long") and wrong for anything
 * structural. A member opening their inbox was shown
 * "Route /api/v1/messages not found" — the express router's internal 404,
 * printed in a yellow banner above their conversations. It names a URL they
 * have never seen, tells them nothing they can do, and reads as the site being
 * broken rather than as a service being briefly unavailable.
 *
 * So anything that looks like plumbing is replaced. The plumbing is still
 * logged to the console, where whoever is actually debugging it will look.
 */
const PLUMBING = /route .* not found|network error|request failed|<!doctype|404|500|502|503|504|ECONNREFUSED|timeout of/i;

const memberFacing = (err: unknown, fallback: string): string => {
    const raw = errorMessage(err, fallback);
    if (!raw || PLUMBING.test(raw)) {
        // eslint-disable-next-line no-console
        console.warn('[messages] suppressed a technical error from the member:', raw);
        return 'Messages are unavailable at the moment. Please try again in a few minutes.';
    }
    return raw;
};

export default function MemberInbox() {
    const [params, setParams] = useSearchParams();
    const openId = params.get('c') || '';

    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [thread, setThread] = useState<Conversation | null>(null);
    const [threadLoading, setThreadLoading] = useState(false);

    const [draft, setDraft] = useState('');

    /**
     * The picture chosen but not yet sent.
     *
     * `file` is what will be uploaded and `preview` is the object URL the
     * strip above the box draws. Both, because a file input that reports
     * “chosen” and shows nothing is how somebody sends the wrong photograph.
     */
    const [picture, setPicture] = useState<{ file: File; preview: string } | null>(null);
    const [emojiOpen, setEmojiOpen] = useState(false);
    const fileRef = useRef<HTMLInputElement | null>(null);
    const boxRef = useRef<HTMLTextAreaElement | null>(null);
    const [sending, setSending] = useState(false);

    const endRef = useRef<HTMLDivElement | null>(null);

    // ------------------------------------------------------------- loading

    const loadInbox = useCallback(async (quiet = false) => {
        if (!quiet) setLoading(true);
        try {
            const data = await listConversations();
            setConversations(data?.conversations || []);
            setError('');
        } catch (err) {
            if (!quiet) setError(memberFacing(err, 'Could not load your messages'));
        } finally {
            if (!quiet) setLoading(false);
        }
    }, []);

    const loadThread = useCallback(async (id: string, quiet = false) => {
        if (!id) return;
        if (!quiet) setThreadLoading(true);
        try {
            const data = await listMessages(id);
            setMessages(data?.messages || []);
            setThread(data?.conversation || null);
            /*
             * Marked read on OPEN, not on scroll-to-bottom. A member who opens a
             * thread has seen it; leaving the badge up until they reach the last
             * line makes the count disagree with what is on their screen.
             */
            await markConversationRead(id).catch(() => null);
            setConversations(prev => prev.map(c => (c.id === id ? { ...c, unread: 0 } : c)));
        } catch (err) {
            if (!quiet) setError(memberFacing(err, 'Could not open this conversation'));
        } finally {
            if (!quiet) setThreadLoading(false);
        }
    }, []);

    useEffect(() => { loadInbox(); }, [loadInbox]);
    useEffect(() => {
        if (openId) loadThread(openId);
        else { setMessages([]); setThread(null); }
    }, [openId, loadThread]);

    /** The poll. Quiet — it must never flash a spinner over a read thread. */
    useEffect(() => {
        const tick = () => {
            if (document.hidden) return;
            loadInbox(true);
            if (openId) loadThread(openId, true);
        };
        const id = window.setInterval(tick, 10000);
        return () => window.clearInterval(id);
    }, [openId, loadInbox, loadThread]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ block: 'end' });
    }, [messages.length, openId]);

    // -------------------------------------------------------------- sending

    /** Chosen, shown, and revocable — nothing is uploaded until Send. */
    const choosePicture = (file?: File | null) => {
        if (!file) return;
        setPicture((current) => {
            /* The old object URL is released, or every picture a member
               changes their mind about stays in memory for the session. */
            if (current) URL.revokeObjectURL(current.preview);
            return { file, preview: URL.createObjectURL(file) };
        });
    };

    const dropPicture = () => {
        setPicture((current) => {
            if (current) URL.revokeObjectURL(current.preview);
            return null;
        });
        if (fileRef.current) fileRef.current.value = '';
    };

    /**
     * An emoji goes in AT THE CURSOR, not on the end.
     *
     * Somebody adding one mid-sentence means it there, and appending it to the
     * end of the draft silently moves it. The selection is restored after the
     * insert so they can keep typing where they were.
     */
    const insertEmoji = (mark: string) => {
        const box = boxRef.current;
        const at = box ? box.selectionStart : draft.length;
        const to = box ? box.selectionEnd : draft.length;
        const next = draft.slice(0, at) + mark + draft.slice(to);
        setDraft(next);
        setEmojiOpen(false);
        window.requestAnimationFrame(() => {
            if (!box) return;
            box.focus();
            const caret = at + mark.length;
            box.setSelectionRange(caret, caret);
        });
    };

    const submit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        const body = draft.trim();
        /* TEXT OR A PICTURE. A photograph with no caption is an ordinary
           message; one with neither is nothing at all. */
        if ((!body && !picture) || !openId || sending) return;

        setSending(true);
        try {
            /*
             * The file goes up FIRST and its url travels with the message.
             *
             * Two calls rather than a multipart send, which is what lets a
             * picture be sent with no caption and keeps the send atomic: a send
             * refused by the membership check after the bytes had landed would
             * leave the upload orphaned on the server.
             */
            const url = picture ? await uploadMessageImage(picture.file) : '';
            const sent = await sendMessage(openId, body, url);
            setDraft('');
            dropPicture();
            /*
             * Appended from the SERVER's reply rather than optimistically from
             * the draft. The server assigns the id and the timestamp, and a
             * locally invented pair means the next poll cannot tell the echo
             * from the real thing — which is how a sent message appears twice.
             */
            if (sent) setMessages(prev => [...prev, sent]);
            loadInbox(true);
        } catch (err) {
            setError(memberFacing(err, 'That message could not be sent'));
        } finally {
            setSending(false);
        }
    };

    const openThread = (id: string) => {
        setParams(id ? { c: id } : {}, { replace: false });
    };

    const peerName = thread?.withMember?.fullName || 'Member';
    const peerWhere = useMemo(
        () => [thread?.withMember?.block, thread?.withMember?.district, thread?.withMember?.state]
            .filter(Boolean).join(', '),
        [thread],
    );

    // --------------------------------------------------------------- render

    if (loading) {
        return <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" aria-hidden />;
    }

    /* `BIZ_CARD` — the Business Account form's card, as used everywhere else. */
    const CARD = 'bg-white rounded-2xl border border-slate-200 '
        + 'shadow-[0_1px_2px_rgba(16,24,40,0.04),0_10px_30px_-12px_rgba(16,24,40,0.28)]';

    /*
     * ONE HEIGHT FOR BOTH PANES.
     *
     * The list was as tall as its contents and the thread was a fixed 24rem
     * plus its header and composer, so a member with one conversation got a
     * 9rem card beside a 32rem one — two rectangles with nothing in common but
     * a top edge. A screen is not aligned because its boxes start together; it
     * is aligned because they finish together.
     *
     * A fixed height rather than `items-stretch`, because the thread has to
     * scroll INSIDE itself: stretching to match a list that grows with the
     * number of conversations would push the composer off the bottom of the
     * page, which is the one control that must always be reachable.
     */
    /*
     * The panes grow with the window.
     *
     * 512px was a fixed height on a screen that has nothing else on it, so
     * two thirds of the window was empty dotted background under a short pair
     * of cards. `70vh` uses what is there; the 34rem floor stops a laptop
     * getting a letterbox, and the 46rem ceiling stops a tall monitor
     * stretching one exchange over a metre of white.
     */
    const PANE = 'h-[clamp(40rem,78vh,56rem)]';

    return (
        <div className="space-y-4">
            {error ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[1.1875rem] font-medium text-amber-800">{error}</p>
                </div>
            ) : null}

            {/*
              * ONE PANE ON A PHONE, TWO FROM `lg`.
              *
              * Not a side-by-side squeezed into 390px: a conversation list and a
              * thread each need the full width there, so the thread REPLACES the
              * list and the header carries a back arrow. On a desktop both are
              * useful at once and switching panes would lose the reader's place.
              */}
            {/* 26rem, not 22: a name and “Ariyalur, Ariyalur, Tamil Nadu” did
                not fit on one line, so every row wrapped. */}
            <div className="grid gap-5 lg:grid-cols-[26rem_minmax(0,1fr)] items-start">
                <div className={`${CARD} ${PANE} ${openId ? 'hidden lg:flex' : 'flex'}
                                 flex-col overflow-hidden`}>
                    <div className="shrink-0 px-5 py-4 border-b border-slate-200 bg-slate-50">
                        <p className="text-[1.0625rem] font-extrabold uppercase tracking-[0.12em] text-slate-500">
                            Conversations
                        </p>
                    </div>

                    {conversations.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <EmptyState
                                icon={<Inbox className="w-6 h-6" />}
                                title="No conversations yet"
                                detail="Open a member from the directory and choose Message to start one."
                            />
                        </div>
                    ) : (
                        <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
                            {conversations.map((c) => (
                                <li key={c.id}>
                                    <button
                                        type="button"
                                        onClick={() => openThread(c.id)}
                                        className={`w-full text-left px-4 py-3.5 flex items-start gap-3
                                                    transition-colors hover:bg-slate-50
                                                    ${c.id === openId ? 'bg-blue-50' : ''}`}
                                    >
                                        <span className="shrink-0 w-10 h-10 rounded-xl bg-blue-600 text-white
                                                         text-[1.1875rem] font-bold flex items-center justify-center">
                                            {initialsOf(c.withMember?.fullName || '')}
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center justify-between gap-2">
                                                <span className="text-[1.1875rem] font-bold text-slate-900 truncate">
                                                    {c.withMember?.fullName || 'Member'}
                                                </span>
                                                <span className="text-[1.0625rem] font-medium text-slate-400 shrink-0">
                                                    {timeOf(c.lastMessageAt)}
                                                </span>
                                            </span>
                                            <span className="flex items-center justify-between gap-2 mt-0.5">
                                                <span className="text-[1.0625rem] font-medium text-slate-500 truncate">
                                                    {c.lastMessageMine ? 'You: ' : ''}
                                                    {c.lastMessageText || 'No messages yet'}
                                                </span>
                                                {c.unread > 0 ? (
                                                    <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full
                                                                     bg-blue-600 text-white text-[1.0625rem]
                                                                     font-bold flex items-center justify-center">
                                                        {c.unread}
                                                    </span>
                                                ) : null}
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* ------------------------------------------------- thread */}
                <div className={`${CARD} ${PANE} ${openId ? 'flex' : 'hidden lg:flex'}
                                 flex-col overflow-hidden`}>
                    {!openId ? (
                        <div className="flex-1 flex items-center justify-center">
                            <EmptyState
                                icon={<Inbox className="w-6 h-6" />}
                                title="No conversation open"
                                detail="Choose a conversation on the left, or start one from a member's directory profile."
                            />
                        </div>
                    ) : (
                        <>
                            <div className="shrink-0 px-4 sm:px-5 py-3.5 border-b border-slate-200
                                            bg-slate-50 flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => openThread('')}
                                    className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 bg-white
                                               flex items-center justify-center text-slate-600"
                                    aria-label="Back to conversations"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <span className="shrink-0 w-10 h-10 rounded-xl bg-blue-600 text-white
                                                 text-[1.1875rem] font-bold flex items-center justify-center">
                                    {initialsOf(peerName)}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[1.25rem] font-extrabold tracking-tight
                                                     text-slate-900 truncate">
                                        {peerName}
                                    </span>
                                    {peerWhere ? (
                                        <span className="block text-[1.1875rem] font-medium text-slate-500 truncate">
                                            {peerWhere}
                                        </span>
                                    ) : null}
                                </span>
                            </div>

                            {/*
                              * THE SCROLL BOX ONLY EXISTS WHEN THERE IS SOMETHING TO SCROLL.
                              *
                              * The loading and empty states used to render INSIDE it with
                              * `h-full`, which is 100% of the box PLUS its own `py-4` — so an
                              * empty conversation overflowed by 32px and drew a scrollbar down
                              * a panel containing one centred sentence. Three sibling branches
                              * instead: two that fill the pane and one that scrolls.
                              */}
                            {threadLoading ? (
                                <div className="flex-1 flex items-center justify-center text-slate-400">
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center px-5">
                                    <p className="text-center text-[1.1875rem] font-bold text-slate-500">
                                        No messages yet. Say hello.
                                    </p>
                                </div>
                            ) : (
                                <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-2.5">
                                    {messages.map((m) => (
                                        <div
                                            key={m.id}
                                            className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5
                                                            ${m.mine
                                                        ? 'bg-blue-600 text-white rounded-br-md'
                                                        : 'bg-slate-100 text-slate-900 rounded-bl-md'}`}
                                            >
                                                {/*
                                                  The picture, above its caption.

                                                  Opened in a new tab rather than
                                                  in a lightbox: a specification
                                                  sheet is read at full size and
                                                  often saved, and the browser
                                                  already does both.
                                                */}
                                                {m.attachmentUrl ? (
                                                    <a
                                                        href={resolveMediaUrl(m.attachmentUrl)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className={`mb-2 block overflow-hidden rounded-xl
                                                                    ${m.body ? '' : '-mx-1 -mt-1'}`}
                                                    >
                                                        <img
                                                            src={resolveMediaUrl(m.attachmentUrl)}
                                                            alt=""
                                                            loading="lazy"
                                                            className="max-h-72 w-full object-cover"
                                                        />
                                                    </a>
                                                ) : null}

                                                {/* `whitespace-pre-wrap`: a member who typed
                                                    line breaks meant them. Nothing is drawn
                                                    for a picture sent without a caption — an
                                                    empty paragraph is a gap under the image. */}
                                                {m.body ? (
                                                    <p className="text-[1.1875rem] leading-relaxed whitespace-pre-wrap
                                                                  break-words">
                                                        {m.body}
                                                    </p>
                                                ) : null}
                                                <p className={`text-[1.0625rem] mt-1 ${
                                                    m.mine ? 'text-blue-100' : 'text-slate-400'}`}>
                                                    {timeOf(m.at)}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={endRef} />
                                </div>
                            )}

                            {/*
                              ==================================================
                              TWO SURFACES, AND THE DIFFERENCE IS THE POINT
                              ==================================================

                              This was drawn ONLY on a thread with no messages
                              in it, which meant that on every live conversation
                              in the database it did not exist — including the
                              ones full of the “hi” it was written to replace.
                              The association reported the openers as missing
                              and they were right.

                              An EMPTY thread gets the labelled list below, the
                              way the leader enquiry form asks “What is it
                              about?”: each option with a line saying what it is
                              for. Somebody with nothing typed has room to read.

                              A LIVE thread gets one quiet row of chips above
                              the box, further down, and only while the box is
                              empty — it goes the moment they start typing,
                              because by then they know what they want to say.

                              `!threadLoading` is what stops the FLASH: `messages`
                              is [] while a thread is still being fetched, so the
                              list drew for a beat on every conversation that
                              already had messages in it and then vanished, which
                              reads as the screen losing something.
                            */}
                            {!threadLoading && messages.length === 0 && !draft.trim() && (
                                <div className="shrink-0 overflow-y-auto border-t border-slate-200
                                                bg-white px-4 py-4">
                                    <p className="mb-1 text-[1.25rem] font-bold text-slate-900">
                                        What is it about?
                                    </p>
                                    <p className="mb-3 text-[1.1875rem] text-slate-500">
                                        Pick one to start. It goes in the box below for you to change
                                        before you send it.
                                    </p>

                                    <div className="grid gap-2 sm:grid-cols-3">
                                        {OPENERS.map((opener) => (
                                            <button
                                                key={opener.label}
                                                type="button"
                                                onClick={() => setDraft(
                                                    opener.text.replace(
                                                        '{name}',
                                                        peerName.split(' ')[0] || 'there',
                                                    ),
                                                )}
                                                className="rounded-xl border border-slate-200 bg-white px-4 py-3
                                                           text-left transition-colors hover:border-blue-400
                                                           hover:bg-blue-50"
                                            >
                                                <span className="block text-[1.1875rem] font-bold text-slate-900">
                                                    {opener.label}
                                                </span>
                                                <span className="mt-0.5 block text-[1.0625rem] leading-snug
                                                                 text-slate-500">
                                                    {opener.hint}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/*
                              THE SAME OPENERS, ON A LIVE THREAD — one row, and
                              only while the box is empty. See the note above.
                            */}
                            {!threadLoading && messages.length > 0 && !draft.trim() && !picture && (
                                <div className="shrink-0 border-t border-slate-200 bg-white px-3 pb-1 pt-2.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-[1.0625rem] font-bold uppercase tracking-wider
                                                         text-slate-400">
                                            Start with
                                        </span>
                                        {OPENERS.map((opener) => (
                                            <button
                                                key={opener.label}
                                                type="button"
                                                title={opener.hint}
                                                onClick={() => setDraft(
                                                    opener.text.replace(
                                                        '{name}',
                                                        peerName.split(' ')[0] || 'there',
                                                    ),
                                                )}
                                                className="rounded-full border border-slate-200 bg-white px-3 py-1.5
                                                           text-[1.0625rem] font-semibold text-slate-600
                                                           transition-colors hover:border-blue-400
                                                           hover:bg-blue-50 hover:text-blue-700"
                                            >
                                                {opener.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/*
                              THE CHOSEN PICTURE, BEFORE IT GOES.

                              A file input that reports “chosen” and shows nothing
                              is how somebody sends the wrong photograph. It is
                              shown at a size you can recognise it at, with the
                              file's name and a way to take it off again.
                            */}
                            {picture ? (
                                <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2.5">
                                    <div className="flex items-center gap-3 rounded-xl border border-slate-200
                                                    bg-slate-50 p-2">
                                        <img
                                            src={picture.preview}
                                            alt=""
                                            className="h-16 w-16 shrink-0 rounded-lg object-cover"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-[1.1875rem] font-semibold text-slate-800">
                                                {picture.file.name}
                                            </p>
                                            <p className="text-[1.0625rem] text-slate-500">
                                                Ready to send — a caption is optional.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={dropPicture}
                                            aria-label="Remove picture"
                                            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors
                                                       hover:bg-slate-200 hover:text-slate-700"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ) : null}

                            <form
                                onSubmit={submit}
                                className="relative shrink-0 border-t border-slate-200 bg-slate-50 p-3
                                           flex items-end gap-2"
                            >
                                {/*
                                  A SHORT CURATED GRID, not a picker library.

                                  A full emoji keyboard is 1,800 characters and a
                                  megabyte of data behind a button somebody presses
                                  to say “yes”. These are what two members reach
                                  for, and each goes in at the cursor.
                                */}
                                {emojiOpen ? (
                                    <div className="absolute bottom-full left-3 z-20 mb-2 w-72 rounded-2xl
                                                    border border-slate-200 bg-white p-3 shadow-xl">
                                        <div className="grid grid-cols-8 gap-1">
                                            {EMOJI.map((mark, i) => (
                                                <button
                                                    key={`${mark}-${i}`}
                                                    type="button"
                                                    onClick={() => insertEmoji(mark)}
                                                    className="rounded-lg py-1.5 text-[1.375rem] leading-none
                                                               transition-colors hover:bg-slate-100"
                                                >
                                                    {mark}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => choosePicture(e.target.files?.[0])}
                                />

                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    aria-label="Send a picture"
                                    className="mb-0.5 shrink-0 rounded-xl border border-slate-200 bg-white p-2.5
                                               text-slate-500 transition-colors hover:border-blue-400
                                               hover:bg-blue-50 hover:text-blue-600"
                                >
                                    <ImagePlus className="h-5 w-5" />
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setEmojiOpen((open) => !open)}
                                    aria-label="Insert an emoji"
                                    aria-expanded={emojiOpen}
                                    className={`mb-0.5 shrink-0 rounded-xl border p-2.5 transition-colors ${
                                        emojiOpen
                                            ? 'border-blue-400 bg-blue-50 text-blue-600'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'
                                    }`}
                                >
                                    <Smile className="h-5 w-5" />
                                </button>

                                <textarea
                                    ref={boxRef}
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                        // Enter sends; Shift+Enter is a new line. The
                                        // opposite makes a two-line message a two-message
                                        // conversation.
                                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
                                    }}
                                    rows={1}
                                    maxLength={4000}
                                    placeholder={
                                        picture
                                            ? 'Add a caption, or send the picture on its own…'
                                            : messages.length === 0
                                                ? 'Write about your business — what you make, what you need…'
                                                : `Message ${peerName.split(' ')[0] || 'member'}…`
                                    }
                                    /* 20px, matching the member area's body
                                       text. 18px here read as a smaller screen
                                       than the ones on either side of it. */
                                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-white
                                               px-4 py-3 text-[1.25rem] text-slate-900 outline-none
                                               transition-colors placeholder:text-slate-400
                                               focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
                                               max-h-36"
                                />
                                {/* A picture on its own is a message, so the button
                                    is live with an empty box. A comment cannot live
                                    between two ATTRIBUTES — inside a JSX opening tag
                                    `{…}` is spread syntax, not a comment slot. */}
                                <button
                                    type="submit"
                                    disabled={(!draft.trim() && !picture) || sending}
                                    className="shrink-0 inline-flex items-center justify-center gap-2 h-11 px-4
                                               rounded-xl bg-blue-600 text-[1.1875rem] font-bold text-white shadow-sm
                                               transition-colors hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {sending
                                        ? <Loader2 className="w-4 h-4 animate-spin" />
                                        : <Send className="w-4 h-4" />}
                                    <span className="hidden sm:inline">Send</span>
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
