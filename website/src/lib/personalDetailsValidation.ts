import { validateMobile } from './phoneNumber';
import { GENDERS, SOCIAL_CATEGORIES, normalizeReligion, religionsFor } from './memberFormOptions';

type PersonalOptions = { international?: boolean; blockRequired?: boolean };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** Same completion rules as the API. Country and block applicability are
 * supplied by the server or the loaded form options, never guessed. */
export function personalDetailsErrors(value: any, options: PersonalOptions = {}): Record<string, string> {
  const data = value && typeof value === 'object' ? value : {};
  const errors: Record<string, string> = {};
  const abroad = options.international ?? data.isInternational === true;
  const required = ['fullName', 'email', 'phoneNumber', 'socialCategory', 'religion', 'gender'];
  if (abroad) required.push('place');
  else {
    required.push('state', 'district', 'city');
    if (options.blockRequired ?? data.personalDetailsBlockRequired === true) required.push('block');
  }
  for (const key of required) if (!text(data[key])) errors[key] = 'Required';
  if (text(data.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(data.email))) errors.email = 'Enter a valid email address';
  if (text(data.phoneNumber) && !validateMobile(data.phoneNumber).ok) errors.phoneNumber = 'Enter a valid mobile number';
  if (text(data.socialCategory) && !(SOCIAL_CATEGORIES as readonly string[]).includes(text(data.socialCategory))) errors.socialCategory = 'Choose a social category from the list';
  const religion = normalizeReligion(text(data.religion));
  if (text(data.religion) && (!religion || !religionsFor(text(data.socialCategory)).includes(religion))) errors.religion = 'Choose a religion from the available list';
  if (text(data.gender) && !(GENDERS as readonly string[]).some(gender => gender.toLowerCase() === text(data.gender).toLowerCase())) errors.gender = 'Choose a gender from the list';
  return errors;
}
