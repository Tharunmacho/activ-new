type Section = Record<string, unknown>;
export const businessFormError = (data: Section): string => {
  const doing = data.doingBusiness;
  const yes = doing === true || doing === 'yes' || doing === 'true';
  const no = doing === false || doing === 'no' || doing === 'false';
  if (!yes && !no) return 'Complete Business information: answer whether you are doing business.';
  if (no && !['aspirant', 'student'].includes(String(data.registrationType || data.nonBusinessKind || '').toLowerCase())) return 'Choose Aspirant or Student in Business information.';
  const year = String(data.businessCommencementYear || '').trim();
  const currentYear = new Date(Date.now() + 330 * 60 * 1000).getUTCFullYear();
  if (yes && (!/^\d{4}$/.test(year) || Number(year) < 1800 || Number(year) > currentYear)) return 'Enter a valid business commencement year.';
  return '';
};
export const declarationFormError = (data: Section, business: boolean): string => {
  if (data.agreeToDeclaration !== true) return 'Please accept the declaration to proceed.';
  if (!business) return '';
  const value = data.sisterConcerns ?? 0;
  if (!/^\d+$/.test(String(value === '' ? 0 : value).trim()) || !Number.isSafeInteger(Number(value || 0))) return 'Enter a whole number of sister concerns, or 0 if none.';
  const names = Array.isArray(data.companyNames) ? data.companyNames.filter(name => typeof name === 'string' && name.trim()) : [];
  if (names.length !== Number(value || 0)) return 'Enter one company name for each sister concern, or correct the number of sister concerns.';
  return '';
};
