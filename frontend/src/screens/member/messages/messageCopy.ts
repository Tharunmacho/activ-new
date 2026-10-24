import { errorText } from '../../../ui';

/**
 * Website MemberInbox `memberFacing`: a member is never shown plumbing
 * ("Route … not found", a status code, a timeout) — the server's own sentence
 * when it has one, otherwise one plain line.
 */
const PLUMBING = /route .* not found|network error|request failed|<!doctype|404|500|502|503|504|ECONNREFUSED|timeout of/i;

export const memberFacing = (err: any, fallback: string): string => {
  const raw = errorText(err, fallback);
  if (!raw || PLUMBING.test(raw)) {
    console.warn('[messages] suppressed a technical error from the member:', raw);
    return 'Messages are unavailable at the moment. Please try again in a few minutes.';
  }
  return raw;
};

/** Website OPENERS — the three ways a first business message usually starts. */
export const OPENERS: { label: string; hint: string; text: string; icon: string }[] = [
  {
    label: 'Supply enquiry',
    hint: 'You are looking for a supplier and want to know what they make.',
    text: 'Dear {name}, I am an ACTIV member and I am looking for a supplier '
      + 'for our line. Could you tell me what you currently manufacture or trade in? Thank you for your time.',
    icon: 'manage-search',
  },
  {
    label: 'Ask for a quotation',
    hint: 'You know what you need and want a price for it.',
    text: 'Dear {name}, I would like a quotation for one of your products. '
      + 'May I send you the specification and the quantity we need? Thank you for your help.',
    icon: 'request-quote',
  },
  {
    label: 'Work together on an order',
    hint: 'An order larger than your own capacity, shared with a member.',
    text: 'Dear {name}, we have an order that is larger than our own capacity '
      + 'and I am looking for an ACTIV member to take part of it. Would that be '
      + 'of interest? Thank you for considering it.',
    icon: 'handshake',
  },
];

/** Website EMOJI — a short curated grid, not a picker library. */
export const EMOJI = [
  '👍', '👏', '🙏', '✅', '❌', '❗', '❓', '👀',
  '😊', '🙂', '😅', '😢', '🎉', '🔥', '💯', '⭐',
  '📦', '🚚', '🏭', '🛍️', '💰', '📈', '📄', '📎',
  '📞', '📲', '📅', '⏰', '📍', '🤝', '🤝', '📧',
];

/** Website MEMBERS_ONLY_COPY (memberAccess.ts). */
export const MEMBERS_ONLY_COPY = {
  title: 'Messaging is part of an active membership',
  detail: 'Direct messages and member-to-member connections open the moment your membership is active. '
    + 'Everything else the association publishes — the events programme, updates and the member directory — is open to you right now.',
  short: 'Connecting with members needs an active membership.',
};

/** "4:05 pm" today, "12 Sep" otherwise (website MemberInbox timeOf). */
export const timeOf = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  if (d.toDateString() === new Date().toDateString()) {
    const h = d.getHours();
    return `${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
  }
  return `${d.getDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
};
