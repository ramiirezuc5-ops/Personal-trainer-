import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Badge, type Tone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { TextAreaField } from '../components/ui/Field';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { ApiError } from '../services/api';
import { meApi } from '../services/endpoints';
import type { Appointment, AppointmentStatus } from '../types/api';
import { addDaysYmd, APPOINTMENT_STATUS_LABEL, formatDateLong, formatTime, toYmd } from '../utils/format';
import p from './pages.module.css';

const TONE: Record<AppointmentStatus, Tone> = { reservado: 'info', confirmado: 'success', completado: 'neutral', cancelado: 'danger' };

function BookingPanel({ date, onBooked }: { date: string; onBooked: () => void }) {
  const { notify } = useToast();
  const { data, error, loading, reload } = useAsync(() => meApi.availability(date), [date]);
  const [picked, setPicked] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const closePicked = useCallback(() => setPicked(null), []);

  if (loading && !data) return <LoadingBlock label="Buscando horarios…" />;
  if (error != null && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  if (!data.enabled) return <Alert tone="info">Tu entrenador todavía no habilitó la reserva online. Pedile un turno directamente.</Alert>;
  if (data.slots.length === 0) return <p className={p.empty}>No hay horarios disponibles este día. Probá con otra fecha.</p>;

  async function book() {
    if (!picked) return;
    setSaving(true);
    try { await meApi.book({ start: picked, ...(notes.trim() ? { notes: notes.trim() } : {}) }); notify('Turno reservado.'); setNotes(''); onBooked(); closePicked(); reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'Ese horario ya no está disponible. Elegí otro.', 'danger'); closePicked(); reload(); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div className={p.formGrid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
        {data.slots.map((s) => (
          <Button key={s} variant="secondary" onClick={() => setPicked(s)}>{formatTime(s)}</Button>
        ))}
      </div>
      <ConfirmDialog open={picked !== null} loading={saving} title="Confirmar turno" confirmLabel="Reservar"
        message={(
          <div className={p.formStack}>
            <p style={{ margin: 0 }}>{picked ? `${formatDateLong(picked)} a las ${formatTime(picked)}.` : ''}</p>
            <TextAreaField label="Nota para tu entrenador (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} />
          </div>
        )}
        onCancel={closePicked} onConfirm={() => void book()} />
    </>
  );
}

export default function MyAppointments() {
  const { notify } = useToast();
  const [date, setDate] = useState(() => toYmd(new Date()));
  const upcoming = useAsync(() => meApi.appointments({ from: new Date().toISOString(), limit: 50 }), []);
  useRefreshOnFocus(upcoming.reload);
  const [toCancel, setToCancel] = useState<Appointment | null>(null);
  const [busy, setBusy] = useState(false);
  const closeCancel = useCallback(() => setToCancel(null), []);
  const bookedForDay = useMemo(() => new Set((upcoming.data?.items ?? []).filter((a) => a.status !== 'cancelado').map((a) => toYmd(new Date(a.start)))), [upcoming.data]);

  async function cancel() {
    if (!toCancel) return;
    setBusy(true);
    try { await meApi.cancelAppointment(toCancel._id); notify('Turno cancelado.'); upcoming.reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo cancelar el turno.', 'danger'); }
    finally { setBusy(false); setToCancel(null); }
  }

  const items = (upcoming.data?.items ?? []).filter((a) => a.status !== 'cancelado');

  return (
    <>
      <PageHeader title="Mis turnos" description="Tus próximos turnos y los horarios libres para reservar." />

      <div className={p.stack}>
        <Card title="Próximos turnos">
          {upcoming.loading && !upcoming.data && <LoadingBlock label="Cargando…" />}
          {upcoming.error != null && !upcoming.data && <ErrorState error={upcoming.error} onRetry={upcoming.reload} />}
          {upcoming.data && items.length === 0 && <EmptyState icon={<Calendar size={24} />} title="No tenés turnos próximos" description="Reservá uno abajo, en los horarios disponibles." />}
          {upcoming.data && items.length > 0 && (
            <ul className={p.list}>
              {items.map((a) => (
                <li key={a._id} className={p.item}>
                  <div className={p.itemMain}>
                    <span className={p.itemTitle}>{formatDateLong(a.start)} · {formatTime(a.start)}–{formatTime(a.end)}</span>
                    <span className={p.muted}>{a.type}{a.notes ? ` · ${a.notes}` : ''}</span>
                  </div>
                  <div className={p.rowActions} style={{ alignItems: 'center' }}>
                    <Badge tone={TONE[a.status]}>{APPOINTMENT_STATUS_LABEL[a.status]}</Badge>
                    {(a.status === 'reservado' || a.status === 'confirmado') && <Button size="sm" variant="ghost" onClick={() => setToCancel(a)}>Cancelar</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Reservar un turno">
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
            <Button variant="secondary" aria-label="Día anterior" onClick={() => setDate((d) => addDaysYmd(d, -1))}><ChevronLeft size={18} aria-hidden="true" /></Button>
            <strong style={{ flex: 1, textAlign: 'center' }}>{formatDateLong(`${date}T12:00:00`)}</strong>
            <Button variant="secondary" aria-label="Día siguiente" onClick={() => setDate((d) => addDaysYmd(d, 1))}><ChevronRight size={18} aria-hidden="true" /></Button>
          </div>
          {bookedForDay.has(date) && <div style={{ marginBottom: 'var(--space-4)' }}><Alert tone="info">Ya tenés un turno este día.</Alert></div>}
          <BookingPanel date={date} onBooked={upcoming.reload} />
        </Card>
      </div>

      <ConfirmDialog open={toCancel !== null} danger loading={busy} title="¿Cancelar el turno?" confirmLabel="Cancelar turno"
        message={toCancel ? `${formatDateLong(toCancel.start)} a las ${formatTime(toCancel.start)}.` : ''}
        onCancel={closeCancel} onConfirm={() => void cancel()} />
    </>
  );
}
