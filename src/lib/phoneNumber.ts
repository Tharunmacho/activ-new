/**
 * The browser's copy of the server's phone-number rule.
 *
 * The authority is `backend/src/modules/common/phoneNumber.js` and this must
 * agree with it exactly. A client that is STRICTER than the server merely
 * annoys; a client that is LOOSER is worse than none at all, because it lets a
 * number through, the applicant fills in three more fields, and the server then
 * rejects the whole registration for something they typed on the first screen.
 *
 * WHY IT IS DUPLICATED RATHER THAN IMPORTED. The website and the API are two
 * deployments with no shared package between them, and the alternative — a
 * round trip per keystroke to validate a phone number — is a network call to
 * answer a question about ten characters. If the two ever need to diverge, they
 * should not: change the server file and copy it here.
 *
 * WHAT THIS DOES NOT DO. It does not prove the number is on WhatsApp. Nothing
 * available does — Meta's contacts lookup answers "valid" for every number now,
 * and BotBee publishes no contact check. This rejects numbers that cannot be
 * real; it cannot confirm the ones that could be.
 */

import {
    DEFAULT_COUNTRY,
    DEFAULT_MIN,
    E164_MAX,
    countryByIso2,
    countryFromDial,
} from './countryCodes';

export interface PhoneCheck {
    ok: boolean;
    /** The bare ten national digits, once a country code and spacing are gone. */
    national: string;
    /** A sentence for the person who typed it, not for a log. */
    reason: string;
}

/**
 * Strip a `+91`/`91`/`0091` country code and a domestic trunk `0`.
 *
 * The trunk zero has to go BEFORE the length is judged, or `09876543210` reads
 * as eleven digits and is rejected for being too long — which is how a form
 * refuses a number written exactly as it appears on the handset.
 */
export const toNational = (value: unknown): string => {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '';

    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);

    return digits;
};

const isAllSameDigit = (n: string) => /^(\d)\1{9}$/.test(n);

/** A run in either direction — 1234567890 and 9876543210 alike. */
const isSequential = (n: string) => {
    let up = true;
    let down = true;
    for (let i = 1; i < n.length; i += 1) {
        const step = Number(n[i]) - Number(n[i - 1]);
        if (step !== 1) up = false;
        if (step !== -1) down = false;
    }
    return up || down;
};

/** One two-digit pair repeated five times: 9090909090. */
const isRepeatedPair = (n: string) => n.length === 10 && n.slice(0, 2).repeat(5) === n;

/**
 * Judge one number.
 *
 * @param label how the field is named back to the person, e.g. "WhatsApp number"
 */
export const validateIndianMobile = (value: unknown, label = 'Phone number'): PhoneCheck => {
    const raw = String(value ?? '').trim();
    if (!raw) return { ok: false, national: '', reason: `${label} is required` };

    const national = toNational(raw);

    if (national.length !== 10) {
        return { ok: false, national: '', reason: `${label} must be a 10-digit Indian mobile number` };
    }

    if (!/^[6-9]/.test(national)) {
        // Naming the rule beats "invalid": somebody who typed a landline needs
        // to know it is the KIND of number that is wrong, not a digit of it.
        return {
            ok: false,
            national,
            reason: `${label} must start with 6, 7, 8 or 9 — that is what an Indian mobile number begins with`,
        };
    }

    if (isAllSameDigit(national) || isSequential(national) || isRepeatedPair(national)) {
        return {
            ok: false,
            national,
            reason: `${national} is not a real mobile number. Please enter the number you actually use.`,
        };
    }

    return { ok: true, national, reason: '' };
};

/* ---------------------------------------------------------------- worldwide */

export interface MobileCheck extends PhoneCheck {
    /** ISO 3166-1 alpha-2 of the country the number was judged against. */
    country: string;
    /** Dialling code, digits only. */
    dial: string;
    /**
     * What to submit. Bare ten digits for India, `+<dial><national>` otherwise
     * — see the note on the server twin for why the two formats differ.
     */
    stored: string;
}

/**
 * The browser's copy of `validateMobile` in
 * `backend/src/modules/common/phoneNumber.js`. Same warning as the file header:
 * the server is the authority, and a looser copy here is worse than none.
 *
 * The country comes from the dropdown, so it is passed explicitly rather than
 * sniffed out of the string — but the `+` prefix is honoured too, for a value
 * pasted in whole.
 */
export const validateMobile = (
    value: unknown,
    country?: string,
    label = 'Phone number',
): MobileCheck => {
    const raw = String(value ?? '').trim();
    const blank: MobileCheck = {
        ok: false, national: '', reason: `${label} is required`,
        country: '', dial: '', stored: '',
    };
    if (!raw) return blank;

    const chosen = countryByIso2(country)
        || (raw.startsWith('+') ? countryFromDial(raw) : undefined)
        || countryByIso2(DEFAULT_COUNTRY);

    if (chosen.iso2 === DEFAULT_COUNTRY) {
        const indian = validateIndianMobile(raw, label);
        return {
            ...indian,
            country: DEFAULT_COUNTRY,
            dial: '91',
            stored: indian.ok ? indian.national : '',
        };
    }

    let digits = raw.replace(/[^0-9]/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    // Only strip the dialling code when it is genuinely a prefix — somebody who
    // picked the country and typed the national number alone has typed a valid
    // number, and lopping its first digits off would make it invalid.
    if (digits.startsWith(chosen.dial) && digits.length > chosen.dial.length) {
        digits = digits.slice(chosen.dial.length);
    }
    // A domestic trunk '0', as most of Europe and Africa prints it. Removed
    // before the length is judged, for the same reason India's is.
    if (digits.length > 1 && digits.startsWith('0')) digits = digits.slice(1);

    const national = digits;
    const min = chosen.min || DEFAULT_MIN;
    const max = chosen.max || Math.max(DEFAULT_MIN, E164_MAX - chosen.dial.length);

    if (national.length < min || national.length > max) {
        const expected = min === max ? `${min} digits` : `${min}–${max} digits`;
        return {
            ok: false, national: '', reason: `${label} must be ${expected} for ${chosen.name} (+${chosen.dial})`,
            country: chosen.iso2, dial: chosen.dial, stored: '',
        };
    }

    const allSame = /^(\d)\1+$/.test(national);
    const pair = national.length >= 6 && national.length % 2 === 0
        && national.slice(0, 2).repeat(national.length / 2) === national;
    if (allSame || isSequential(national) || pair) {
        return {
            ok: false, national,
            reason: `${national} is not a real mobile number. Please enter the number you actually use.`,
            country: chosen.iso2, dial: chosen.dial, stored: '',
        };
    }

    return {
        ok: true, national, reason: '',
        country: chosen.iso2, dial: chosen.dial, stored: `+${chosen.dial}${national}`,
    };
};

/**
 * Split a stored value back into a country and the national digits.
 *
 * The inverse of `stored`, for a form that has to show an existing number: a
 * bare value is Indian (that is what bare has always meant here) and a `+`
 * value carries its own answer.
 */
export const splitStored = (value: unknown): { country: string; national: string } => {
    const raw = String(value ?? '').trim();
    if (!raw.startsWith('+')) return { country: DEFAULT_COUNTRY, national: toNational(raw) };

    const hit = countryFromDial(raw);
    if (!hit) return { country: DEFAULT_COUNTRY, national: toNational(raw) };

    const digits = raw.replace(/[^0-9]/g, '');
    return { country: hit.iso2, national: digits.slice(hit.dial.length) };
};

export default validateIndianMobile;
