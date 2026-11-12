import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Alert, LoadingBlock } from '../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError, fieldErrors } from '../services/api';
import { billingApi } from '../services/endpoints';
import type { PaymentMethod } from '../types/api';
import { localNoonISO, money, PAYMENT_METHOD_LABEL, todayISO } from '../utils/format';
import p from './pages.module.css';

const num = (s: string) => Number(s.replace(',', '.'));
const validAmount = (s: string) => s.trim() !== '' && !Number.isNaN(num(s));

/** Convierte un error del servidor en un texto para mostrar. */
function messageOf(err: unknown, fallback: string): string {
  const fe = Object.values(fieldErrors(err));
  return fe.length ? fe.join(' ') : err instanceof ApiError ? err.message : fallback;
}

/* ---------- Registrar un pago ---------- */
export interface PayableMembership { id: string; label: string; due: number; currency: string }
interface PaymentProps { open: boolean; onClose: () => void; studentId: string; studentName?: string; memberships: PayableMembership[]; defaultMembershipId?: string; onDone: () => void }

function PaymentForm({ studentId, memberships, defaultMembershipId, onClose, onDone }: Omit<PaymentProps, 'open' | 'studentName'>) {
  const { notify } = useToast();
  const today = todayISO();
  const first = memberships.find((m) => m.id === defaultMembershipId) ?? memberships[0];
  const [membership, setMembership] = useState(first?.id ?? '');
  const [amount, setAmount] = useState(first ? String(first.due) : '');
  const [method, setMethod] = useState<PaymentMethod>('efectivo');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = memberships.find((m) => m.id === membership);

  function pickMembership(id: string) {
    setMembership(id);
    const m = memberships.find((x) => x.id === id);
    if (m) setAmount(String(m.due)); // sugiere el saldo pendiente; se puede cambiar (pago parcial)
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!validAmount(amount) || num(amount) <= 0) return setError('Ingresá un monto mayor a cero.');
    if (!date || date > today) return setError('La fecha del pago no puede ser futura.');
    setError(''); setSaving(true);
    try {
      await billingApi.createPayment(studentId, {
        amount: num(amount), method,
        ...(membership ? { membership } : {}),
        ...(date !== today ? { paidAt: localNoonISO(date) } : {}), // hoy: el servidor usa la hora actual
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      notify('Pago registrado. El alumno ya lo ve en su app.');
      onDone(); onClose();
    } catch (err) { setError(messageOf(err, 'No pudimos registrar el pago.')); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className={p.formStack}>
      {error && <Alert tone="danger">{error}</Alert>}
      <SelectField label="Mensualidad" value={membership} onChange={(e) => pickMembership(e.target.value)} hint={membership ? undefined : 'Sin mensualidad, el pago queda registrado pero no descuenta ninguna deuda.'}>
        {memberships.map((m) => <option key={m.id} value={m.id}>{m.label} · saldo {money(m.due, m.currency)}</option>)}
        <option value="">Sin asociar a una mensualidad</option>
      </SelectField>
      <div className={p.formGrid}>
        <TextField label="Monto" type="number" inputMode="decimal" min={0} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required
          hint={selected && validAmount(amount) && num(amount) > selected.due ? `Supera el saldo pendiente (${money(selected.due, selected.currency)}).` : undefined} />
        <SelectField label="Método" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
          {Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <TextField label="Fecha del pago" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <TextAreaField label="Nota (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={400} />
      <div className={p.formActions}>
        <Button type="submit" loading={saving}>Registrar pago</Button>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
      </div>
    </form>
  );
}

export function PaymentDialog({ open, onClose, studentName, ...rest }: PaymentProps) {
  return (
    <Modal open={open} onClose={onClose} title={studentName ? `Registrar pago · ${studentName}` : 'Registrar pago'}>
      {open && <PaymentForm {...rest} onClose={onClose} />}
    </Modal>
  );
}

/* ---------- Asignar un plan (crear la mensualidad) ---------- */
function AssignForm({ studentId, onClose, onDone }: { studentId: string; onClose: () => void; onDone: () => void }) {
  const { notify } = useToast();
  const plans = useAsync(() => billingApi.plans(false), []);
  const today = todayISO();
  const [plan, setPlan] = useState('');
  const [start, setStart] = useState(today);
  const [discount, setDiscount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (plans.loading && !plans.data) return <LoadingBlock label="Cargando planes…" />;
  if (plans.error != null && !plans.data) return <Alert tone="danger">No pudimos cargar los planes. Cerrá esta ventana y probá de nuevo.</Alert>;
  const list = plans.data ?? [];
  if (list.length === 0) {
    return <Alert tone="info">Todavía no tenés planes activos. <Link to="/planes">Creá uno primero</Link> y después asignalo.</Alert>;
  }
  const chosen = list.find((x) => x._id === plan);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!chosen) return setError('Elegí un plan.');
    if (discount.trim() && (!validAmount(discount) || num(discount) < 0)) return setError('El descuento debe ser un número mayor o igual a cero.');
    if (discount.trim() && num(discount) > chosen.price) return setError('El descuento no puede superar el precio del plan.');
    if (!start) return setError('Indicá la fecha de inicio.');
    setError(''); setSaving(true);
    try {
      await billingApi.assignMembership(studentId, {
        plan: chosen._id,
        ...(start !== today ? { startDate: localNoonISO(start) } : {}), // hoy: el servidor usa el momento actual
        ...(discount.trim() && num(discount) > 0 ? { discount: { amount: num(discount), ...(reason.trim() ? { reason: reason.trim() } : {}) } } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      notify('Plan asignado. El alumno ya ve su mensualidad.');
      onDone(); onClose();
    } catch (err) { setError(messageOf(err, 'No pudimos asignar el plan.')); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className={p.formStack}>
      {error && <Alert tone="danger">{error}</Alert>}
      <SelectField label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)} required>
        <option value="">Elegí un plan</option>
        {list.map((x) => <option key={x._id} value={x._id}>{x.name} · {money(x.price, x.currency)} · {x.durationDays} días</option>)}
      </SelectField>
      <div className={p.formGrid}>
        <TextField label="Inicio" type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
        <TextField label="Descuento (opcional)" type="number" inputMode="decimal" min={0} step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        <div className={p.span2}><TextField label="Motivo del descuento" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} /></div>
      </div>
      <TextAreaField label="Nota (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} hint="Solo la ves vos." />
      <div className={p.formActions}>
        <Button type="submit" loading={saving}>Asignar plan</Button>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
      </div>
    </form>
  );
}

export function AssignPlanDialog({ open, onClose, studentId, onDone }: { open: boolean; onClose: () => void; studentId: string; onDone: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Asignar plan">
      {open && <AssignForm studentId={studentId} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

/* ---------- Anular un pago ---------- */
function VoidForm({ paymentId, onClose, onDone }: { paymentId: string; onClose: () => void; onDone: () => void }) {
  const { notify } = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) return setError('Contá brevemente el motivo (mínimo 3 letras).');
    setError(''); setSaving(true);
    try { await billingApi.voidPayment(paymentId, reason.trim()); notify('Pago anulado.'); onDone(); onClose(); }
    catch (err) { setError(messageOf(err, 'No pudimos anular el pago.')); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className={p.formStack}>
      <Alert tone="info">El pago no se borra: queda marcado como anulado y el saldo del alumno vuelve a subir.</Alert>
      {error && <Alert tone="danger">{error}</Alert>}
      <TextAreaField label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required />
      <div className={p.formActions}>
        <Button type="submit" variant="danger" loading={saving}>Anular pago</Button>
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
      </div>
    </form>
  );
}

export function VoidPaymentDialog({ paymentId, onClose, onDone }: { paymentId: string | null; onClose: () => void; onDone: () => void }) {
  return (
    <Modal open={paymentId !== null} onClose={onClose} title="Anular pago">
      {paymentId !== null && <VoidForm paymentId={paymentId} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}
