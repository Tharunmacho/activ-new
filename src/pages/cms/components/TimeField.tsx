/**
 * ==========================================================================
 * A TIME IN HOURS, MINUTES AND AM/PM — because the native control will not
 * ==========================================================================
 *
 * `<input type="time">` renders in the BROWSER's locale, and nothing in the
 * page can change that. `lang="en-US"` on the element is widely believed to
 * force a 12-hour clock and does not: Chrome reads the browser's own language
 * setting, so an editor on an en-GB browser gets "14:30" however the markup is
 * written. That was tried here first and reported still wrong.
 *
 * So the control is three plain selects. They are not a downgrade:
 *
 *   - AM/PM is ALWAYS shown, on every machine, which is the whole point. An
 *     event at "09:00" with no meridiem is a morning session or an evening one
 *     and the form cannot say which.
 *   - Minutes are in five-minute steps. A session starting at 09:37 is not a
 *     thing anybody schedules, and a free-text minute field is somewhere to
 *     mistype.
 *   - It is keyboard-operable and screen-reader-labelled by construction,
 *     which a bespoke text mask would have to earn.
 *
 * THE STORED VALUE IS UNCHANGED: "HH:MM" on a 24-hour clock, the same string
 * the native input produced and the same string the server and the mobile app
 * already read. Only the way it is TYPED changes. `''` means "not set" and
 * round-trips as `''` rather than as midnight — a blank time is missing
 * information, not an event at 00:00.
 */
const HOURS = ['12', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

/** "14:30" -> { hour: '02', minute: '30', meridiem: 'PM' }; '' -> all blank. */
const parse = (value: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || '').trim());
    if (!match) return { hour: '', minute: '', meridiem: '' };

    const h24 = Number(match[1]);
    if (!Number.isFinite(h24) || h24 < 0 || h24 > 23) return { hour: '', minute: '', meridiem: '' };

    const meridiem = h24 >= 12 ? 'PM' : 'AM';
    /* 0 -> 12 AM and 12 -> 12 PM. The modulo alone gives "0", which is not an
       hour anybody writes and is not in the list below. */
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;

    return {
        hour: String(h12).padStart(2, '0'),
        /* Kept as stored even when it is not a multiple of five, so opening an
           event scheduled at 09:37 elsewhere does not silently move it. */
        minute: match[2],
        meridiem,
    };
};

/** The three parts back to "HH:MM", or '' while any of them is unset. */
const join = (hour: string, minute: string, meridiem: string) => {
    if (!hour || !minute || !meridiem) return '';
    const h12 = Number(hour);
    const h24 = meridiem === 'PM'
        ? (h12 === 12 ? 12 : h12 + 12)
        : (h12 === 12 ? 0 : h12);
    return `${String(h24).padStart(2, '0')}:${minute}`;
};

const SELECT = `rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[1.25rem]
                text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2
                focus:ring-blue-500/20 dark:border-[#2a2a2a] dark:bg-black
                dark:text-neutral-100`;

export function TimeField({ value, onChange, label }: {
    /** "HH:MM" on a 24-hour clock, or '' for not set. */
    value: string;
    onChange: (next: string) => void;
    /** Used for the accessible names of the three parts. */
    label: string;
}) {
    const { hour, minute, meridiem } = parse(value);

    const set = (part: { hour?: string; minute?: string; meridiem?: string }) => {
        const next = {
            hour: part.hour ?? hour,
            minute: part.minute ?? minute,
            meridiem: part.meridiem ?? meridiem,
        };
        /*
         * A SENSIBLE DEFAULT FOR THE OTHER TWO, so picking one part is not
         * silently a no-op. Choosing "PM" on an empty field ought to give a
         * time, not leave the field blank until all three are set — which is
         * how an editor concludes the control is broken.
         */
        if (part.hour && !next.minute) next.minute = '00';
        if (part.hour && !next.meridiem) next.meridiem = Number(part.hour) < 8 ? 'PM' : 'AM';
        if (part.meridiem && !next.hour) { next.hour = '09'; next.minute = next.minute || '00'; }
        if (part.minute && !next.hour) { next.hour = '09'; next.meridiem = next.meridiem || 'AM'; }

        onChange(join(next.hour, next.minute, next.meridiem));
    };

    return (
        <div className="flex items-center gap-1.5">
            <select
                className={SELECT}
                value={hour}
                aria-label={`${label} — hour`}
                onChange={(e) => set({ hour: e.target.value })}
            >
                <option value="">--</option>
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>

            <span aria-hidden="true" className="text-[1.25rem] font-bold text-slate-400">:</span>

            <select
                className={SELECT}
                value={minute}
                aria-label={`${label} — minute`}
                onChange={(e) => set({ minute: e.target.value })}
            >
                <option value="">--</option>
                {/* The stored minute is offered even when it is off the
                    five-minute grid, so it can be seen and kept. */}
                {(MINUTES.includes(minute) || !minute ? MINUTES : [minute, ...MINUTES])
                    .map((m) => <option key={m} value={m}>{m}</option>)}
            </select>

            <select
                className={SELECT}
                value={meridiem}
                aria-label={`${label} — AM or PM`}
                onChange={(e) => set({ meridiem: e.target.value })}
            >
                <option value="">--</option>
                <option value="AM">AM</option>
                <option value="PM">PM</option>
            </select>

            {value && (
                <button
                    type="button"
                    onClick={() => onChange('')}
                    title={`Clear ${label}`}
                    className="ml-0.5 rounded px-1.5 py-1 text-[1.0625rem] font-semibold
                               text-slate-400 transition-colors hover:bg-slate-100
                               hover:text-slate-700 dark:hover:bg-[#161616]"
                >
                    Clear
                </button>
            )}
        </div>
    );
}

export default TimeField;
