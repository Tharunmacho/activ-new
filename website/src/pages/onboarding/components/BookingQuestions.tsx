import type { RegistrationAnswers, RegistrationField } from '@/lib/eventRegistrationFields';

export default function BookingQuestions({ fields, answers, errors, onChange }: {
    fields: RegistrationField[];
    answers: RegistrationAnswers;
    errors: Record<string, string>;
    onChange: (key: string, value: string | boolean) => void;
}) {
    if (!fields.length) return null;
    return <section className="my-7 space-y-5">
        <h2 className="text-xl font-extrabold text-brand-800">Registration details</h2>
        <p className="text-slate-600">Questions from the event organiser. Required fields are marked *.</p>
        {fields.map(field => {
            const error = errors[`responses.${field.key}`];
            const text = String(answers[field.key] ?? '');
            const id = `registration-${field.key}`;
            const inputClass = `w-full rounded-xl border px-4 py-3 text-base font-semibold ${error ? 'border-red-500' : 'border-slate-300'} focus:ring-2 focus:ring-blue-500`;
            return <div key={field.key} data-invalid={error ? 'true' : undefined}>
                <label htmlFor={id} className="mb-2 block font-bold text-slate-800">{field.label || field.key}{field.required ? ' *' : ''}</label>
                {field.type === 'checkbox' ? <input id={id} type="checkbox" checked={answers[field.key] === true} onChange={e => onChange(field.key, e.target.checked)} required={field.required} aria-invalid={!!error} className="h-5 w-5 accent-blue-600" />
                    : field.type === 'select' ? <select id={id} value={text} required={field.required} aria-invalid={!!error} onChange={e => onChange(field.key, e.target.value)} className={inputClass}><option value="">{field.placeholder || 'Choose an option'}</option>{(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}</select>
                        : field.type === 'textarea' ? <textarea id={id} value={text} rows={3} maxLength={2000} required={field.required} aria-invalid={!!error} placeholder={field.placeholder} onChange={e => onChange(field.key, e.target.value)} className={inputClass} />
                            : <input id={id} type={['number', 'email', 'date'].includes(field.type || '') ? field.type : field.type === 'phone' ? 'tel' : 'text'} value={text} maxLength={2000} required={field.required} aria-invalid={!!error} placeholder={field.placeholder} onChange={e => onChange(field.key, e.target.value)} className={inputClass} />}
                {field.helpText ? <p className="mt-1 text-sm text-slate-600">{field.helpText}</p> : null}
                {error ? <p role="alert" className="mt-1 font-semibold text-red-700">{error}</p> : null}
            </div>;
        })}
    </section>;
}
