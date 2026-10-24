import { readPublicCms, submitPublicCms } from './publicContent';

export type InfoKind = 'about' | 'membership' | 'contact' | 'delete-account' | 'policy';
export function infoPage(path: string): { kind: InfoKind; slug: string; state: string } {
  let slug = String(path || '/about').split(/[?#]/)[0].replace(/^\/+|\/+$/g, '') || 'about';
  try { slug = decodeURIComponent(slug); } catch { /* Invalid slug is rejected by the API. */ }
  if (slug.startsWith('legal/')) slug = slug.slice('legal/'.length);
  let state = '';
  try { state = decodeURIComponent(/[?&]state=([^&#]*)/.exec(path)?.[1]?.replace(/\+/g, ' ') || ''); } catch { /* Invalid filter leaves the head office selected. */ }
  return { kind: ['about', 'membership', 'contact', 'delete-account'].includes(slug) ? slug as InfoKind : 'policy', slug, state };
}
export async function loadPublicInfo(path: string, signal?: AbortSignal) {
  const page = infoPage(path);
  if (page.kind === 'delete-account') return { ...page, content: {} };
  const endpoint = page.kind === 'policy' ? `/cms/legal/${encodeURIComponent(page.slug)}`
    : page.kind === 'contact' ? '/cms/contact-info' : `/cms/${page.kind}`;
  const content = await readPublicCms(endpoint, signal);
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  if (page.kind === 'policy' && (content.slug !== page.slug || content.status !== 'published')) return null;
  return { ...page, content };
}
export type ContactForm = { name: string; email: string; phone: string; subject: string; message: string; memberId?: string };
export async function sendPublicEnquiry(form: ContactForm, deletion = false, confirmed = false) {
  const name = form.name.trim(), email = form.email.trim(), message = form.message.trim();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (!deletion && !message)) {
    throw new Error(deletion ? 'Enter your name and a valid email address.' : 'Enter your name, a valid email address and your message.');
  }
  if (deletion && !confirmed) throw new Error('Confirm that this is your account and you want to request deletion.');
  const limits: [string, string, number][] = [
    ['Name', name, 120], ['Email', email, 200], ['Mobile number', form.phone.trim(), 30],
    ['Subject', form.subject.trim(), 200], ['Membership ID', form.memberId?.trim() || '', 80],
    [deletion ? 'Additional information' : 'Message', message, deletion ? 1500 : 5000],
  ];
  for (const [label, value, max] of limits) {
    if (value.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  }
  // Match the website's staff-verified request flow. This never deletes an account directly.
  const receipt = await submitPublicCms('/cms/contact-messages', {
    name, email, phone: form.phone.trim(),
    subject: deletion ? 'ACTIV account and data deletion request' : form.subject.trim(),
    message: deletion ? [
      'I request deletion of my ACTIV account and associated personal data.',
      'Please verify my account ownership before processing this request.',
      `Member ID (if known): ${form.memberId?.trim() || 'Not provided'}`,
      `Additional information: ${message || 'None'}`,
      'Submitted from the ACTIV app. The requester confirmed that this is their account.',
      'Please reply with the next steps, expected completion date, and any records that must be retained with the reason and retention period.',
    ].join('\n') : message,
  });
  if (!receipt?.id) throw new Error('We could not confirm receipt. Contact ACTIV before submitting the same request again.');
  return receipt;
}
