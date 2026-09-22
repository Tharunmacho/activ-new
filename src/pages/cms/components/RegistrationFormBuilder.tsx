import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { CmsField, CmsInput, CmsSection } from './CmsUI';

/**
 * The registration form for one event, designed by the super admin (EVT-004).
 *
 * Every event asks something different. A conclave needs a delegate category
 * and a meal preference; a factory visit needs a vehicle number; a training day
 * needs a T-shirt size. A fixed form that unions all of those is mostly
 * irrelevant to every event, and members fill in the irrelevant parts wrongly.
 *
 * So the form is data. What is built here is what the member screen renders —
 * that screen holds no list of known fields, because a client that knows the
 * fields is a client that has to ship before a new question can be asked.
 *
 * FOUR FIELDS ARE NOT BUILT HERE and cannot be removed: name, phone,
 * organisation and the note to the organiser. They are columns on the
 * registration record itself, the attendee list has headings for them, and the
 * contact flows read them by name. They are what running an event requires;
 * this builder is for what THIS event requires.
 */

export interface RegistrationField {
    /** Stable identifier. Assigned by the server; never regenerated on rename. */
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'checkbox';
    required: boolean;
    placeholder: string;
    helpText: string;
    options: string[];
}

export const BLANK_FIELD: RegistrationField = {
    key: '',
    label: '',
    type: 'text',
    required: false,
    placeholder: '',
    helpText: '',
    options: [],
};

const TYPES: { value: RegistrationField['type']; label: string }[] = [
    { value: 'text', label: 'Short text' },
    { value: 'textarea', label: 'Long text' },
    { value: 'number', label: 'Number' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'date', label: 'Date' },
    { value: 'select', label: 'Choose one' },
    { value: 'checkbox', label: 'Tick box' },
];

const SELECT_CLASS =
    'w-full bg-slate-50 dark:bg-black border border-slate-300 dark:border-[#2a2a2a] ' +
    'rounded-lg px-3 py-2 text-[1.25rem] text-slate-900 dark:text-neutral-100';

export default function RegistrationFormBuilder({
    fields,
    onChange,
}: {
    fields: RegistrationField[];
    onChange: (fields: RegistrationField[]) => void;
}) {
    const list = Array.isArray(fields) ? fields : [];

    const patch = (index: number, changes: Partial<RegistrationField>) =>
        onChange(list.map((field, i) => (i === index ? { ...field, ...changes } : field)));

    const remove = (index: number) => onChange(list.filter((_, i) => i !== index));

    /*
     * Order is the order members see, so it has to be editable here.
     *
     * Up/down buttons rather than drag-and-drop: this list is rarely more than
     * six rows, and a drag handle that only works with a mouse is unusable on
     * the tablet half of the admins actually use.
     */
    const move = (index: number, delta: number) => {
        const to = index + delta;
        if (to < 0 || to >= list.length) return;

        const next = [...list];
        [next[index], next[to]] = [next[to], next[index]];
        onChange(next);
    };

    const add = () => onChange([...list, { ...BLANK_FIELD }]);

    return (
        <CmsSection
            title="Registration form"
            hint={'The questions this event asks, on top of name, phone, organisation and the note '
                + 'to the organiser — those four are always collected. Members see these in this order.'}
        >
            {list.length === 0 ? (
                <p className="text-[1.1875rem] text-slate-500 dark:text-[#A1A1AA] mb-3">
                    No extra questions yet. Members will be asked for their name, phone, organisation
                    and a note to the organiser.
                </p>
            ) : null}

            <div className="space-y-3">
                {list.map((field, index) => (
                    <div
                        key={index}
                        className="rounded-xl border border-slate-200 dark:border-[#2a2a2a]
                                   bg-slate-50 dark:bg-[#0d0d0d] p-3.5"
                    >
                        {/* ---------------------------------- row header ---- */}
                        <div className="flex items-center gap-2 mb-3">
                            <GripVertical size={14} className="text-slate-400 shrink-0" />
                            <span className="text-[1.1875rem] font-bold text-slate-500 dark:text-[#A1A1AA]">
                                Question {index + 1}
                            </span>

                            <div className="ml-auto flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => move(index, -1)}
                                    disabled={index === 0}
                                    aria-label="Move up"
                                    className="w-7 h-7 rounded-md flex items-center justify-center
                                               text-slate-400 hover:text-slate-700 hover:bg-white
                                               dark:hover:bg-black disabled:opacity-30
                                               disabled:hover:bg-transparent transition-colors"
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => move(index, 1)}
                                    disabled={index === list.length - 1}
                                    aria-label="Move down"
                                    className="w-7 h-7 rounded-md flex items-center justify-center
                                               text-slate-400 hover:text-slate-700 hover:bg-white
                                               dark:hover:bg-black disabled:opacity-30
                                               disabled:hover:bg-transparent transition-colors"
                                >
                                    <ChevronDown size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    aria-label="Remove question"
                                    className="w-7 h-7 rounded-md flex items-center justify-center
                                               text-slate-400 hover:text-red-600 hover:bg-white
                                               dark:hover:bg-black transition-colors"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>

                        {/* ---------------------------------- the field ----- */}
                        <div className="grid gap-3 sm:grid-cols-2">
                            <CmsField label="Question">
                                <CmsInput
                                    value={field.label}
                                    placeholder="e.g. Dietary preference"
                                    onChange={(e) => patch(index, { label: e.target.value })}
                                />
                            </CmsField>

                            <CmsField label="Answer type">
                                <select
                                    className={SELECT_CLASS}
                                    value={field.type}
                                    onChange={(e) => patch(index, {
                                        type: e.target.value as RegistrationField['type'],
                                    })}
                                >
                                    {TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </CmsField>
                        </div>

                        {/*
                          Options, only for a dropdown.

                          One per line rather than a comma-separated box: a
                          category legitimately containing a comma — "Delegate,
                          non-residential" — is otherwise unenterable, and nothing
                          on screen would explain why it split in two.
                        */}
                        {field.type === 'select' ? (
                            <div className="mt-3">
                                <CmsField
                                    label="Options"
                                    hint="One per line. A member picks exactly one of these."
                                >
                                    <textarea
                                        rows={3}
                                        className={SELECT_CLASS}
                                        value={(field.options || []).join('\n')}
                                        placeholder={'Vegetarian\nNon-vegetarian\nJain'}
                                        onChange={(e) => patch(index, {
                                            options: e.target.value.split('\n'),
                                        })}
                                    />
                                </CmsField>
                            </div>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2 mt-3">
                            {/* A tick box's label IS its prompt; a placeholder
                                inside one has nowhere to render. */}
                            {field.type !== 'checkbox' ? (
                                <CmsField label="Placeholder (optional)">
                                    <CmsInput
                                        value={field.placeholder}
                                        onChange={(e) => patch(index, { placeholder: e.target.value })}
                                    />
                                </CmsField>
                            ) : null}

                            <CmsField label="Help text (optional)">
                                <CmsInput
                                    value={field.helpText}
                                    placeholder="Shown under the field"
                                    onChange={(e) => patch(index, { helpText: e.target.value })}
                                />
                            </CmsField>
                        </div>

                        <label className="flex items-center gap-2 mt-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={field.required}
                                onChange={(e) => patch(index, { required: e.target.checked })}
                                className="w-4 h-4 accent-blue-600"
                            />
                            <span className="text-[1.1875rem] text-slate-700 dark:text-neutral-300">
                                Members must answer this
                            </span>
                        </label>
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={add}
                className="mt-3 inline-flex items-center gap-1.5 px-4 h-9 rounded-lg border
                           border-slate-300 dark:border-[#2a2a2a] text-[1.25rem] font-semibold
                           text-slate-700 dark:text-neutral-200 hover:bg-slate-50
                           dark:hover:bg-[#141414] transition-colors"
            >
                <Plus size={15} />
                Add a question
            </button>
        </CmsSection>
    );
}
