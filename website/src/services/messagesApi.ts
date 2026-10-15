import api, { unwrap } from './api';

/**
 * Member-to-member direct messages.
 *
 * Every call here is signed in and every one of them is refused by the server
 * unless BOTH members have an active membership — see the note at the top of
 * `backend/src/modules/messages/message.service.js`. The client does not
 * re-implement that rule; it reads `membershipActive` only to decide what to
 * OFFER, and lets the server decide what is allowed.
 */

export interface ConversationPeer {
    id: string;
    fullName: string;
    organizationName: string;
    photoUrl: string;
    block: string;
    district: string;
    state: string;
}

export interface Conversation {
    id: string;
    withMember: ConversationPeer | null;
    lastMessageText: string;
    lastMessageAt: string | null;
    /** True when the last thing said in the thread was said by ME. */
    lastMessageMine: boolean;
    unread: number;
}

export interface DirectMessage {
    id: string;
    body: string;
    /**
     * A picture sent with the message, or `''`.
     *
     * Always a string, never `undefined` — the server sends `''` when there is
     * none. A field that is sometimes absent is a field every caller has to
     * test twice, and gets wrong once.
     */
    attachmentUrl: string;
    attachment?: MessageAttachment | null;
    /** Whose side of the thread it belongs on. Decided by the SERVER. */
    mine: boolean;
    at: string;
    readAt: string | null;
}

export interface MessageAttachment {
    id: string;
    url: string;
    name: string;
    mimeType: string;
    size: number;
    kind: 'image' | 'file';
}
export interface UploadedMessageAttachment extends MessageAttachment { token: string }

export interface Thread {
    conversation: Conversation;
    messages: DirectMessage[];
    /** More older messages exist above this page. */
    hasMore: boolean;
}

const EMPTY_INBOX = { conversations: [] as Conversation[], unreadTotal: 0 };

export const listConversations = async () =>
    unwrap<typeof EMPTY_INBOX>(await api.get('/messages'), EMPTY_INBOX);

/** Open, or start, the thread with one member. Idempotent on the server. */
export const openConversationWith = async (memberId: string) =>
    unwrap<Conversation>(await api.post(`/messages/with/${memberId}`), null as any);

export const listMessages = async (conversationId: string, before?: string) =>
    unwrap<Thread>(
        await api.get(`/messages/${conversationId}`, { params: before ? { before } : {} }),
        null as any,
    );

/**
 * Send text, a photo or a document. New uploads carry a token so the server
 * verifies the attachment rather than trusting client-supplied metadata.
 */
export const sendMessage = async (
    conversationId: string,
    body: string,
    attachmentUrl = '',
    attachment?: UploadedMessageAttachment,
) =>
    unwrap<DirectMessage>(
        await api.post(`/messages/${conversationId}`, { body, attachmentUrl,
            ...(attachment ? { attachment: { token: attachment.token } } : {}) }),
        null as any,
    );

/** Store a picture and hand back its url. It sends nothing. */
export const uploadMessageImage = async (file: File) => {
    const form = new FormData();
    form.append('image', file);
    return unwrap<{ url: string }>(
        await api.post('/messages/attachment', form),
        { url: '' },
    ).url;
};

/** Upload first; only Send makes the file part of a conversation. */
export const uploadMessageAttachment = async (file: File, onProgress?: (percent: number) => void) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap<UploadedMessageAttachment>(await api.post('/messages/attachment', form, {
        onUploadProgress: event => onProgress?.(event.total ? Math.min(100, Math.round(event.loaded / event.total * 100)) : 0),
    }), null as any);
};

/** Documents are downloaded through the signed-in API, never a public upload link. */
export const downloadMessageAttachment = async (attachment: MessageAttachment) => {
    const response = await api.get(`/messages/attachments/${encodeURIComponent(attachment.id)}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.name.replace(/[\\/\u0000-\u001f]/g, '_') || 'attachment';
    document.body.appendChild(link);
    try { link.click(); }
    finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
};

export const markConversationRead = async (conversationId: string) =>
    unwrap<{ ok: boolean }>(await api.post(`/messages/${conversationId}/read`), { ok: false });

export const getUnreadMessageCount = async () =>
    unwrap<{ unread: number }>(await api.get('/messages/unread-count'), { unread: 0 }).unread;
