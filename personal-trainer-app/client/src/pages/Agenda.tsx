import { Calendar, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, type Tone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { SelectField } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError } from '../services/api';
import { appointmentsApi } from '../services/endpoints';
import type { Appointment, AppointmentStatus } from '../types/api';
import { addDaysYmd, APPOINTMENT_STATUS_LABEL, formatDateLong, formatTime, toYmd } from '../utils/format';
import { NewAppointmentDialog, RescheduleDialog } from './AppointmentDialogs';
import p from './pages.module.css';

const TONE: Record<AppointmentStatus, Tone> = { reservado: 'info', confirmado: 'success', completado: 'neutral', cancelado: 'danger' };

export default function Agenda() {
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const date = params.get('fecha') || toYmd(new Date());
  const status = params.get('estado') ?? '';

  const setDate = useCallback((d: string) => setParams((prev) => { const n = new URLSearchParams(prev); n.set('fecha', d); return n; }, { replace: true }), [setParams]);
  const setStatus = useCallback((s: string) => setParams((prev) => { const n = new URLSearchParams(prev); s ? n.set('estado', s) : n.delete('estado'); return n; }, { replace: true }), [setParams]);

  const range = useMemo(() => ({ from: new Date(`${date}T00:00:00`).toISOString(), to: new Date(`${addDaysYmd(date, 1)}T00:00:00`).toISOString() }), [date]);
  const { data, error, loading, reload } = useAsync(() => appointmentsApi.list({ from: range.from, to: range.to, status: (status || undefined) as AppointmentStatus | undefined, limit: 100 }), [range, status]);

  const [creating, setCreating] = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);
  const [toCancel, setToCancel] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);
  const closeNew = useCallback(() => setCreating(false), []);
  const closeReschedule = useCallback(() => setRescheduling(null), []);
  const closeCancel = useCallback(() => setToCancel(null), []);

  async function confirm(appt: Appointment) {
    setBusy(true);
    try { await appointmentsApi.setStatus(appt._id, 'confirmado'); notify('Turno confirmado.'); reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo confirmar.', 'danger'); }
    finally { setBusy(false); }
  }
  async function complete(appt: Appointment) {
    setBusy(true);
    try { await appointmentsApi.setStatus(appt._id, 'completado'); notify('Turno marcado como completado.'); reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo completar.', 'danger'); }
    finally { setBusy(false); }
  }
  async function cancel() {
    if (!toCancel) return;
    setBusy(true);
    try { await appointmentsApi.cancel(toCancel._id); notify('Turno cancelado.'); reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo cancelar.', 'danger'); }
    finally { setBusy(false); setToCancel(null); }
  }

  const items = data?.items ?? [];

  return (
    <>
      <PageHeader title="Agenda" description={formatDateLong(range.from)} actions={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setCreating(true)}>Nuevo turno</Button>} />

      <div className={p.filters2} role="search">
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'end' }}>
          <Button variant="secondary" aria-label="Día anterior" onClick={() => setDate(addDaysYmd(date, -1))}><ChevronLeft size={18} aria-hidden="true" /></Button>
          <div style={{ flex: 1 }}>
            <label htmlFor="agenda-date" style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 650, marginBottom: 'var(--space-1)' }}>Fecha</label>
            <input id="agenda-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', minHeight: 'var(--touch-target)', padding: '0 var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', font: 'inherit' }} />
          </div>
          <Button variant="secondary" aria-label="Día siguiente" onClick={() => setDate(addDaysYmd(date, 1))}><ChevronRight size={18} aria-hidden="true" /></Button>
          <Button variant="ghost" onClick={() => setDate(toYmd(new Date()))}>Hoy</Button>
        </div>
        <SelectField label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(APPOINTMENT_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
      </div>

      {loading && !data && <LoadingBlock label="Cargando turnos…" />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}

      {data && items.length === 0 && (
        <div className={p.listCard}>
          <EmptyState icon={<Calendar size={24} />} title="Sin turnos este día" description="Creá uno nuevo o elegí otra fecha." action={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setCreating(true)}>Nuevo turno</Button>} />
        </div>
      )}

      {data && items.length > 0 && (
        <div className={p.listCard} aria-busy={loading}>
          {items.map((a) => {
            const student = typeof a.student === 'string' ? null : a.student;
            const live = a.status === 'reservado' || a.status === 'confirmado';
            return (
              <div key={a._id} className={p.rowStatic}>
                <div className={p.rowMain}>
                  <span className={p.rowName}>{formatTime(a.start)}–{formatTime(a.end)} · {student ? <Link to={`/alumnos/${student._id}`}>{student.lastName}, {student.firstName}</Link> : 'Alumno'}</span>
                  <span className={p.rowMeta}><Badge tone={TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge><span>{a.type}</span>{a.notes && <span>· {a.notes}</span>}{a.cancellation?.reason && <span>· {a.cancellation.reason}</span>}</span>
                </div>
                {live && (
                  <div className={p.rowActions}>
                    {a.status === 'reservado' && <Button size="sm" loading={busy} onClick={() => void confirm(a)}>Confirmar</Button>}
                    {a.status === 'confirmado' && <Button size="sm" loading={busy} onClick={() => void complete(a)}>Completar</Button>}
                    <Button size="sm" variant="secondary" onClick={() => setRescheduling(a)}>Reprogramar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setToCancel(a)}>Cancelar</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <NewAppointmentDialog open={creating} onClose={closeNew} onDone={reload} />
      <RescheduleDialog appt={rescheduling} onClose={closeReschedule} onDone={reload} />
      <ConfirmDialog open={toCancel !== null} danger loading={busy} title="¿Cancelar el turno?" confirmLabel="Cancelar turno"
        message={toCancel ? `${formatTime(toCancel.start)} del ${formatDateLong(toCancel.start)}. El alumno verá el turno como cancelado.` : ''}
        onCancel={closeCancel} onConfirm={() => void cancel()} />
    </>
  );
}
