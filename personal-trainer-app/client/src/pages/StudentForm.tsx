import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { CheckGroup, SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { ApiError, fieldErrors } from '../services/api';
import type { Level, Student, StudentInput } from '../types/api';
import { isEmail, LEVEL_LABEL } from '../utils/format';
import p from './pages.module.css';

const EDITABLE = [
  { value: 'phone', label: 'Teléfono' }, { value: 'birthDate', label: 'Fecha de nacimiento' },
  { value: 'availability', label: 'Disponibilidad horaria' }, { value: 'goal', label: 'Objetivo' },
];

interface Props { initial?: Student; submitLabel: string; onSubmit: (input: StudentInput) => Promise<void>; onCancel?: () => void }

export function StudentForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [v, setV] = useState({
    firstName: initial?.firstName ?? '', lastName: initial?.lastName ?? '', email: initial?.email ?? '', phone: initial?.phone ?? '',
    birthDate: initial?.birthDate?.slice(0, 10) ?? '', goal: initial?.goal ?? '', experienceLevel: (initial?.experienceLevel ?? 'principiante') as Level,
    availability: initial?.availability ?? '', notes: initial?.notes ?? '',
  });
  const [editable, setEditable] = useState<string[]>(initial?.studentEditableFields ?? ['phone', 'availability']);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!v.firstName.trim()) next.firstName = 'Ingresá el nombre.';
    if (!v.lastName.trim()) next.lastName = 'Ingresá el apellido.';
    if (!v.email.trim()) next.email = 'Ingresá el correo electrónico.';
    else if (!isEmail(v.email.trim())) next.email = 'Revisá el formato del correo (ej.: nombre@correo.com).';
    setErrors(next); setServerError('');
    if (Object.keys(next).length) return;

    const input: StudentInput = {
      firstName: v.firstName.trim(), lastName: v.lastName.trim(), email: v.email.trim(), experienceLevel: v.experienceLevel,
      phone: v.phone.trim(), goal: v.goal.trim(), availability: v.availability.trim(), notes: v.notes.trim(), studentEditableFields: editable,
      ...(v.birthDate ? { birthDate: v.birthDate } : {}),
    };
    setLoading(true);
    try { await onSubmit(input); }
    catch (err) {
      const fe = fieldErrors(err);
      if (err instanceof ApiError && err.code === 'EMAIL_TAKEN') setErrors({ email: 'Ya existe una cuenta con ese correo.' });
      else if (Object.keys(fe).length) setErrors(fe);
      else setServerError(err instanceof ApiError ? err.message : 'No pudimos guardar los datos.');
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      {serverError && <div style={{ marginBottom: 'var(--space-4)' }}><Alert tone="danger">{serverError}</Alert></div>}
      <div className={p.formGrid}>
        <TextField label="Nombre" value={v.firstName} onChange={set('firstName')} error={errors.firstName} autoComplete="off" required />
        <TextField label="Apellido" value={v.lastName} onChange={set('lastName')} error={errors.lastName} autoComplete="off" required />
        <TextField label="Correo electrónico" type="email" value={v.email} onChange={set('email')} error={errors.email} hint={initial ? undefined : 'Acá le llega la invitación para activar su cuenta.'} autoComplete="off" required />
        <TextField label="Teléfono" type="tel" value={v.phone} onChange={set('phone')} error={errors.phone} />
        <TextField label="Fecha de nacimiento" type="date" value={v.birthDate} onChange={set('birthDate')} error={errors.birthDate} />
        <SelectField label="Nivel de experiencia" value={v.experienceLevel} onChange={set('experienceLevel')} error={errors.experienceLevel}>
          {Object.entries(LEVEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <div className={p.span2}><TextField label="Objetivo de entrenamiento" value={v.goal} onChange={set('goal')} error={errors.goal} /></div>
        <div className={p.span2}><TextField label="Disponibilidad horaria" value={v.availability} onChange={set('availability')} error={errors.availability} hint="Ej.: lunes, miércoles y viernes por la mañana." /></div>
        <div className={p.span2}><TextAreaField label="Observaciones (privadas)" value={v.notes} onChange={set('notes')} error={errors.notes} hint="Solo las ve el entrenador. Evitá cargar información médica." /></div>
        <div className={p.span2}><CheckGroup legend="Datos que el alumno puede editar" hint="El resto solo lo modificás vos." options={EDITABLE} value={editable} onChange={setEditable} /></div>
      </div>
      <div className={p.formActions}>
        <Button type="submit" loading={loading}>{submitLabel}</Button>
        {onCancel && <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancelar</Button>}
      </div>
    </form>
  );
}
