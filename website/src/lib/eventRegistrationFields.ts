export type RegistrationField = { key: string; label: string; type?: string; required?: boolean; placeholder?: string; helpText?: string; options?: string[] };
export type RegistrationAnswers = Record<string, string | boolean>;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
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
