import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Alert } from '../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError, fieldErrors } from '../services/api';
import { appointmentsApi, studentsApi } from '../services/endpoints';
import type { Appointment } from '../types/api';
import { todayISO } from '../utils/format';
import p from './pages.module.css';

function messageOf(err: unknown, fallback: string): string {
  const fe = Object.values(fieldErrors(err));
  return fe.length ? fe.join(' ') : err instanceof ApiError ? err.message : fallback;
}

/* ---------- Nuevo turno ---------- */
function NewForm({ defaultStudent, onClose, onDone }: { defaultStudent?: string; onClose: () => void; onDone: () => void }) {
  const { notify } = useToast();
  const students = useAsync(() => studentsApi.list({ limit: 100, sort: 'name' }), []);
  const today = todayISO();
  const [student, setStudent] = useState(defaultStudent ?? '');
  const [date, setDate] = useState(today);
  const [start, setStart] = useState('09:00');
  const [duration, setDuration] = useState('60');
  const [type, setType] = useState('Sesión individual');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!student) return setError('Elegí un alumno.');
    if (!date || date < today) return setError('La fecha no puede ser anterior a hoy.');
    const mins = Number(duration);
    if (!Number.isInteger(mins) || mins < 15 || mins > 480 || mins % 15 !== 0) return setError('La duración debe ser múltiplo de 15 minutos, entre 15 y 480.');
    setError(''); setSaving(true);
    try {
      const startIso = new Date(`${date}T${start}:00`).toISOString();
      const endIso = new Date(new Date(startIso).getTime() + mins * 60_000).toISOString();
      await appointmentsApi.create({ student, start: startIso, end: endIso, type: type.trim() || undefined, notes: notes.trim() || undefined });
      notify('Turno creado.');
      onDone(); onClose();
    } catch (err) { setError(messageOf(err, 'No pudimos crear el turno.')); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className={p.formStack}>
      {error && <Alert tone="danger">{error}</Alert>}
      <SelectField label="Alumno" value={student} onChange={(e) => setStudent(e.target.value)} required disabled={students.loading}>
        <option value="">Elegí un alumno</option>
        {(students.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
      </SelectField>
      <div className={p.formGrid}>
        <TextField label="Fecha" type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} required />
        <TextField label="Hora de inicio" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} required />
        <TextField label="Duración (minutos)" type="number" inputMode="numeric" min={15} max={480} step={15} value={duration} onChange={(e) => setDuration(e.target.value)} required />
        <TextField label="Tipo de sesión" value={type} onChange={(e) => setType(e.target.value)} maxLength={60} />
      </div>
      <TextAreaField label="Nota (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} />
      <div className={p.formActions}>
        <Button type="submit" loading={saving}>Crear turno</Button>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
      </div>
    </form>
  );
}

export function NewAppointmentDialog({ open, onClose, defaultStudent, onDone }: { open: boolean; onClose: () => void; defaultStudent?: string; onDone: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Nuevo turno">
      {open && <NewForm defaultStudent={defaultStudent} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

/* ---------- Reprogramar ---------- */
function RescheduleForm({ appt, onClose, onDone }: { appt: Appointment; onClose: () => void; onDone: () => void }) {
  const { notify } = useToast();
  const today = todayISO();
  const durationMin = Math.round((new Date(appt.end).getTime() - new Date(appt.start).getTime()) / 60000);
  const startDate = new Date(appt.start);
  const [date, setDate] = useState(startDate.toISOString().slice(0, 10) < today ? today : new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  const [time, setTime] = useState(startDate.toTimeString().slice(0, 5));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!date || date < today) return setError('La fecha no puede ser anterior a hoy.');
    setError(''); setSaving(true);
    try {
      const start = new Date(`${date}T${time}:00`).toISOString();
      const end = new Date(new Date(start).getTime() + durationMin * 60_000).toISOString();
      await appointmentsApi.reschedule(appt._id, start, end);
      notify('Turno reprogramado.');
      onDone(); onClose();
    } catch (err) { setError(messageOf(err, 'No pudimos reprogramar el turno.')); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className={p.formStack}>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className={p.formGrid}>
        <TextField label="Nueva fecha" type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} required />
        <TextField label="Nueva hora" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required />
      </div>
      <p className={p.muted}>Dura {durationMin} minutos, igual que antes.</p>
      <div className={p.formActions}>
        <Button type="submit" loading={saving}>Reprogramar</Button>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
      </div>
    </form>
  );
}

export function RescheduleDialog({ appt, onClose, onDone }: { appt: Appointment | null; onClose: () => void; onDone: () => void }) {
  return (
    <Modal open={appt !== null} onClose={onClose} title="Reprogramar turno">
      {appt !== null && <RescheduleForm appt={appt} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}
