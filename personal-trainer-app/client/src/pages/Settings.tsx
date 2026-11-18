import { Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError, fieldErrors } from '../services/api';
import { settingsApi } from '../services/endpoints';
import type { TrainerSettings, WorkingHour } from '../types/api';
import { DAY_LABEL, DAY_ORDER } from '../utils/format';
import p from './pages.module.css';

let rowKey = 0;
interface HourRow extends WorkingHour { key: number }
const toRows = (hs: WorkingHour[]): HourRow[] => hs.map((h) => ({ ...h, key: ++rowKey }));

function SettingsForm({ initial, onSaved }: { initial: TrainerSettings; onSaved: () => void }) {
  const { notify } = useToast();
  const [name, setName] = useState(initial.name);
  const [businessName, setBusinessName] = useState(initial.businessName);
  const [phone, setPhone] = useState(initial.phone);
  const [bio, setBio] = useState(initial.bio);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [hours, setHours] = useState<HourRow[]>(() => toRows(initial.workingHours));
  const [booking, setBooking] = useState(initial.booking);
  const [notifs, setNotifs] = useState(initial.notifications);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const addHour = () => setHours((hs) => [...hs, { key: ++rowKey, weekday: 1, start: '09:00', end: '10:00' }]);
  const updateHour = (key: number, patch: Partial<WorkingHour>) => setHours((hs) => hs.map((h) => (h.key === key ? { ...h, ...patch } : h)));
  const removeHour = (key: number) => setHours((hs) => hs.filter((h) => h.key !== key));

  function validate(): string[] {
    const out: string[] = [];
    if (name.trim().length < 2) out.push('Escribí tu nombre.');
    for (const h of hours) if (h.end <= h.start) out.push(`${DAY_LABEL[h.weekday]}: la hora de fin debe ser posterior a la de inicio.`);
    const byDay = new Map<number, HourRow[]>();
    for (const h of hours) { const list = byDay.get(h.weekday) ?? []; if (list.some((o) => h.start < o.end && h.end > o.start)) out.push(`${DAY_LABEL[h.weekday]}: hay horarios superpuestos.`); list.push(h); byDay.set(h.weekday, list); }
    if (booking.allowStudentBooking && hours.length === 0) out.push('Para permitir la reserva online, cargá al menos un horario de atención.');
    return out;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setProblems(found);
    if (found.length) return;
    setSaving(true);
    try {
      await settingsApi.update({
        name: name.trim(), businessName: businessName.trim(), phone: phone.trim(), bio: bio.trim(), timezone,
        workingHours: hours.map(({ key: _key, ...h }) => h),
        booking, notifications: notifs,
      });
      notify('Configuración guardada.');
      onSaved();
    } catch (err) {
      const fe = Object.values(fieldErrors(err));
      setProblems(fe.length ? fe : [err instanceof ApiError ? err.message : 'No pudimos guardar la configuración.']);
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className={p.formStack}>
      {problems.length > 0 && (
        <Alert tone="danger">{problems.length === 1 ? problems[0] : <>Revisá estos puntos:<ul className={p.problems}>{problems.map((m, i) => <li key={i}>{m}</li>)}</ul></>}</Alert>
      )}

      <Card title="Tus datos">
        <div className={p.formGrid}>
          <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="Nombre del negocio (opcional)" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <TextField label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <TextField label="Zona horaria" value={timezone} onChange={(e) => setTimezone(e.target.value)} hint="Ej.: America/Argentina/Buenos_Aires" />
          <div className={p.span2}><TextAreaField label="Bio (opcional)" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} /></div>
        </div>
      </Card>

      <Card title="Horarios de atención" actions={<Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} onClick={addHour}>Agregar horario</Button>}>
        {hours.length === 0 && <p className={p.empty}>Todavía no cargaste horarios. Agregá al menos uno para poder usar la agenda y la reserva online.</p>}
        {hours.map((h) => (
          <div key={h.key} className={p.itemBox}>
            <div className={p.itemGrid}>
              <SelectField label="Día" value={h.weekday} onChange={(e) => updateHour(h.key, { weekday: Number(e.target.value) })}>
                {DAY_ORDER.map((n) => <option key={n} value={n}>{DAY_LABEL[n]}</option>)}
              </SelectField>
              <TextField label="Desde" type="time" value={h.start} onChange={(e) => updateHour(h.key, { start: e.target.value })} />
              <TextField label="Hasta" type="time" value={h.end} onChange={(e) => updateHour(h.key, { end: e.target.value })} />
            </div>
            <Button size="sm" variant="ghost" aria-label="Quitar este horario" onClick={() => removeHour(h.key)}><Trash2 size={16} aria-hidden="true" /></Button>
          </div>
        ))}
      </Card>

      <Card title="Reserva online para alumnos">
        <label className={p.exCheck}><input type="checkbox" checked={booking.allowStudentBooking} onChange={(e) => setBooking((b) => ({ ...b, allowStudentBooking: e.target.checked }))} /> Permitir que los alumnos reserven sus turnos</label>
        <div className={p.formGrid} style={{ marginTop: 'var(--space-4)' }}>
          <TextField label="Duración del turno (minutos)" type="number" inputMode="numeric" min={15} max={240} step={15} value={booking.slotMinutes} onChange={(e) => setBooking((b) => ({ ...b, slotMinutes: Number(e.target.value) }))} />
          <TextField label="Anticipación mínima (horas)" type="number" inputMode="numeric" min={0} max={720} value={booking.minNoticeHours} onChange={(e) => setBooking((b) => ({ ...b, minNoticeHours: Number(e.target.value) }))} />
          <TextField label="Anticipación máxima (días)" type="number" inputMode="numeric" min={1} max={365} value={booking.maxAdvanceDays} onChange={(e) => setBooking((b) => ({ ...b, maxAdvanceDays: Number(e.target.value) }))} />
          <TextField label="Plazo para cancelar (horas)" type="number" inputMode="numeric" min={0} max={720} value={booking.cancellationHours} onChange={(e) => setBooking((b) => ({ ...b, cancellationHours: Number(e.target.value) }))} />
        </div>
      </Card>

      <Card title="Notificaciones">
        <div className={p.formStack}>
          <label className={p.exCheck}><input type="checkbox" checked={notifs.email} onChange={(e) => setNotifs((n) => ({ ...n, email: e.target.checked }))} /> Avisos por correo</label>
          <label className={p.exCheck}><input type="checkbox" checked={notifs.paymentDue} onChange={(e) => setNotifs((n) => ({ ...n, paymentDue: e.target.checked }))} /> Avisar pagos vencidos</label>
          <label className={p.exCheck}><input type="checkbox" checked={notifs.appointmentReminders} onChange={(e) => setNotifs((n) => ({ ...n, appointmentReminders: e.target.checked }))} /> Recordatorios de turnos</label>
        </div>
      </Card>

      <div className={p.formActions}>
        <Button type="submit" loading={saving}>Guardar configuración</Button>
      </div>
    </form>
  );
}

export default function Settings() {
  const { data, error, loading, reload } = useAsync(() => settingsApi.get(), []);
  return (
    <>
      <PageHeader title="Configuración" description="Tus datos, horarios de atención y reglas de reserva." />
      {loading && !data && <LoadingBlock label="Cargando configuración…" />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}
      {/* key={data.updatedAt ?? ''}: si el guardado trae un perfil nuevo, el formulario se reinicia con esos valores en vez de arrastrar lo tipeado. */}
      {data && <SettingsForm key={JSON.stringify(data)} initial={data} onSaved={reload} />}
    </>
  );
}
