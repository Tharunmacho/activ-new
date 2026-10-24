import { isPastEvent } from '../../../utils/eventLifecycle';

export type BookingPerson = { name: string; email: string; phone: string };
export type RegistrationField = { key: string; label: string; type?: string; required?: boolean; placeholder?: string; helpText?: string; options?: string[] };
export type RegistrationAnswers = Record<string, string | boolean>;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MOBILE_RE = /^[6-9]\d{9}$/;
export const nationalMobile = (value: string): string => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits;
};
export const bookingParticipants = (booker: BookingPerson, rows: BookingPerson[], count: number, useBookerForFirstParticipant = true): BookingPerson[] =>
  Array.from({ length: count }, (_, index) => {
    const row = rows[index] || { name: '', email: '', phone: '' };
    const person = useBookerForFirstParticipant && index === 0 && ![row.name, row.email, row.phone].some(value => value.trim()) ? booker : row;
    return { name: person.name.trim(), email: person.email.trim().toLowerCase(), phone: nationalMobile(person.phone) };
  });

export function validateRegistrationAnswers(fields: RegistrationField[] = [], answers: RegistrationAnswers = {}) {
  const errors: Record<string, string> = {};
  fields.forEach(field => {
    const raw = answers[field.key];
    const value = typeof raw === 'string' ? raw.trim() : '';
    const label = field.label || field.key;
    const invalid = (message: string) => { errors[`responses.${field.key}`] = message; };
    if (field.type === 'checkbox') { if (field.required && raw !== true && raw !== 'true') invalid(`${label} must be ticked`); }
    else if (field.required && !value) invalid(`${label} is required`);
    else if (value.length > 2000) invalid(`${label} must be 2000 characters or fewer`);
    else if (value && field.type === 'select' && !(field.options || []).some(option => option.toLowerCase() === value.toLowerCase())) invalid(`Choose an option for ${label}`);
    else if (value && field.type === 'email' && !EMAIL_RE.test(value)) invalid(`Enter a valid email for ${label}`);
    else if (value && field.type === 'number' && !Number.isFinite(Number(value))) invalid(`Enter a number for ${label}`);
    else if (value && field.type === 'phone' && !/^\+?[\d\s().-]{7,25}$/.test(value)) invalid(`Enter a valid phone number for ${label}`);
    else if (value && field.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) invalid(`Enter a valid date for ${label}`);
  });
  return errors;
}

export function validateBookingForm(booker: BookingPerson, rows: BookingPerson[], count: number, max: number, fields: RegistrationField[] = [], answers: RegistrationAnswers = {}, useBookerForFirstParticipant = true) {
  const errors = validateRegistrationAnswers(fields, answers);
  if (!booker.name.trim()) errors.name = 'Please enter your name';
  if (!booker.email.trim()) errors.email = 'Please enter your email address';
  else if (!EMAIL_RE.test(booker.email.trim())) errors.email = 'Enter a valid email address';
  const phone = nationalMobile(booker.phone);
  if (!phone) errors.phone = 'Please enter your mobile number';
  else if (!MOBILE_RE.test(phone)) errors.phone = 'Enter a valid 10-digit mobile number';
  if (!Number.isInteger(count) || count < 1) errors.count = 'Enter how many people are attending';
  else if (count > max) errors.count = `At most ${max} per booking`;
  const seenEmail = new Set<string>();
  bookingParticipants(booker, rows, count, useBookerForFirstParticipant).forEach((row, i) => {
    if (!row.name) errors[`p${i}.name`] = 'Please enter the participant’s name';
    if (!row.email) errors[`p${i}.email`] = 'Please enter the participant’s email address';
    else if (!EMAIL_RE.test(row.email)) errors[`p${i}.email`] = 'Enter a valid email address';
    if (!row.phone) errors[`p${i}.phone`] = 'Please enter the participant’s mobile number';
    else if (!MOBILE_RE.test(row.phone)) errors[`p${i}.phone`] = 'Enter a valid 10-digit mobile number';
    if (row.email && seenEmail.has(row.email)) errors[`p${i}.email`] = 'Use another email';
    if (row.email) seenEmail.add(row.email);
  });
  return errors;
}

export const mapBookingErrors = (error: any): Record<string, string> => {
  const fields = error?.response?.data?.fields;
  if (!fields || typeof fields !== 'object') return {};
  return Object.fromEntries(Object.entries(fields).map(([key, message]) => {
    const match = key.match(/^participants\.(\d+)\.(name|email|phone)$/);
    return [match ? `p${match[1]}.${match[2]}` : key, String(message)];
  }));
};

export const bookingClosed = (event: any, now = Date.now()): boolean => !!(event?.closed || event?.archivedAt || isPastEvent(event, now)
  || (event?.registrationClosesAt && Number.isFinite(Date.parse(event.registrationClosesAt)) && Date.parse(event.registrationClosesAt) <= now));

export function bookingState(booking: any, now = Date.now()) {
  const status = String(booking?.status || 'active');
  const payment = String(booking?.payment?.status || 'pending');
  const needsReview = !!booking?.payment?.reconciliationRequired || (status === 'waitlist' && payment === 'paid');
  const expired = status === 'expired' || (payment === 'pending' && booking?.expiresAt && Date.parse(booking.expiresAt) <= now);
  const settled = !needsReview && (status === 'active' || (status === 'expired' && payment === 'paid')) && ['paid', 'not_required'].includes(payment);
  const payable = status === 'active' && payment === 'pending' && !expired && !booking?.eventArchived;
  const headline = needsReview ? 'Payment received — organiser review needed' : settled ? 'Booking confirmed' : status === 'cancelled' ? 'Booking cancelled' : status === 'waitlist' ? 'You are on the waitlist'
    : payment === 'failed' ? 'Payment failed' : expired ? 'Payment hold expired' : 'Payment not completed';
  return { status, payment, settled, payable, needsReview, expired: !!expired, headline,
    paymentLabel: payment === 'paid' ? 'Paid' : payment === 'not_required' ? 'Not required' : payment === 'failed' ? 'Failed' : 'Pending' };
}
