import { CircleAlert } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import s from './ui.module.css';

interface Shared { label: string; error?: string; hint?: string; required?: boolean }

function Shell({ id, label, error, hint, required, children }: Shared & { id: string; children: ReactNode }) {
  return (
    <div className={s.field}>
      <label htmlFor={id} className={s.label}>{label}{required && <span className={s.req} aria-hidden="true">*</span>}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className={s.hint}>{hint}</p>}
      {/* El error se anuncia con texto e ícono, no solo con color. */}
      {error && <p id={`${id}-error`} className={s.error} role="alert"><CircleAlert size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />{error}</p>}
    </div>
  );
}

const describe = (id: string, error?: string, hint?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

export const TextField = forwardRef<HTMLInputElement, Shared & InputHTMLAttributes<HTMLInputElement>>(function TextField({ label, error, hint, required, ...rest }, ref) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} required={required}>
      <input ref={ref} id={id} className={s.control} required={required} aria-required={required || undefined} aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest} />
    </Shell>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, Shared & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField({ label, error, hint, required, children, ...rest }, ref) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} required={required}>
      <select ref={ref} id={id} className={s.control} aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest}>{children}</select>
    </Shell>
  );
});

export const TextAreaField = forwardRef<HTMLTextAreaElement, Shared & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextAreaField({ label, error, hint, required, ...rest }, ref) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} required={required}>
      <textarea ref={ref} id={id} className={s.control} aria-invalid={error ? true : undefined} aria-describedby={describe(id, error, hint)} {...rest} />
    </Shell>
  );
});

interface CheckGroupProps { legend: string; hint?: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }
export function CheckGroup({ legend, hint, options, value, onChange }: CheckGroupProps) {
  return (
    <fieldset className={s.field} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className={s.label}>{legend}</legend>
      <div className={s.checks}>
        {options.map((o) => (
          <label key={o.value} className={s.check}>
            <input type="checkbox" checked={value.includes(o.value)} onChange={(e) => onChange(e.target.checked ? [...value, o.value] : value.filter((v) => v !== o.value))} />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className={s.hint}>{hint}</p>}
    </fieldset>
  );
}
