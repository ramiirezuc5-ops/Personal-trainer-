import { CircleDollarSign, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Badge, type Tone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError } from '../services/api';
import { billingApi } from '../services/endpoints';
import type { MembershipStatus } from '../types/api';
import { formatDate, MEMBERSHIP_LABEL, money } from '../utils/format';
import { AssignPlanDialog, PaymentDialog, type PayableMembership } from './BillingDialogs';
import p from './pages.module.css';

const TONE: Record<MembershipStatus, Tone> = { pendiente: 'info', activa: 'success', vencida: 'danger', cancelada: 'neutral' };

/** Mensualidad y pagos de un alumno, dentro de su ficha. Lo que se carga acá lo ve el alumno en su app. */
export function StudentBilling({ studentId, studentName, onChanged }: { studentId: string; studentName: string; onChanged: () => void }) {
  const { notify } = useToast();
  const { data, error, loading, reload } = useAsync(() => billingApi.memberships(studentId), [studentId]);
  const [assigning, setAssigning] = useState(false);
  const [paying, setPaying] = useState<{ defaultId?: string } | null>(null);
  const [toCancel, setToCancel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const closeAssign = useCallback(() => setAssigning(false), []);
  const closePay = useCallback(() => setPaying(null), []);
  const closeCancel = useCallback(() => setToCancel(null), []);
  const changed = useCallback(() => { reload(); onChanged(); }, [reload, onChanged]);

  const payable: PayableMembership[] = (data ?? [])
    .filter((m) => m.status !== 'cancelada' && m.due > 0)
    .map((m) => ({ id: m._id, label: m.plan?.name ?? 'Plan', due: m.due, currency: m.priceSnapshot.currency }));

  async function cancel(id: string) {
    setBusy(true);
    try { await billingApi.cancelMembership(id); notify('Mensualidad cancelada.'); changed(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo cancelar.', 'danger'); }
    finally { setBusy(false); setToCancel(null); }
  }

  return (
    <Card title="Mensualidad y pagos" actions={(
      <div className={p.rowActions}>
        <Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => setAssigning(true)}>Asignar plan</Button>
        <Button size="sm" icon={<CircleDollarSign size={16} aria-hidden="true" />} onClick={() => setPaying({})} disabled={!data}>Registrar pago</Button>
      </div>
    )}>
      {loading && !data && <LoadingBlock label="Cargando mensualidades…" />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}
      {data && data.length === 0 && <p className={p.empty}>Este alumno todavía no tiene mensualidades. Asignale un plan para empezar a registrar pagos.</p>}
      {data && data.length > 0 && (
        <ul className={p.list}>
          {data.map((m) => (
            <li key={m._id} className={p.item}>
              <div className={p.itemMain}>
                <span className={p.itemTitle}>{m.plan?.name ?? 'Plan'} <Badge tone={TONE[m.status]}>{MEMBERSHIP_LABEL[m.status]}</Badge></span>
                <span className={p.muted}>
                  {formatDate(m.startDate)} al {formatDate(m.endDate)} · {money(m.priceSnapshot.amount, m.priceSnapshot.currency)}
                  {m.discount && m.discount.amount > 0 ? ` − ${money(m.discount.amount, m.priceSnapshot.currency)} de descuento` : ''}
                  {' '}· pagado {money(m.paid, m.priceSnapshot.currency)}
                  {m.status !== 'cancelada' && m.due > 0 ? ` · debe ${money(m.due, m.priceSnapshot.currency)}` : ''}
                </span>
              </div>
              <div className={p.rowActions}>
                {m.status !== 'cancelada' && m.due > 0 && <Button size="sm" variant="secondary" onClick={() => setPaying({ defaultId: m._id })}>Registrar pago</Button>}
                {(m.status === 'activa' || m.status === 'pendiente') && <Button size="sm" variant="ghost" onClick={() => setToCancel(m._id)}>Cancelar</Button>}
              </div>
            </li>
          ))}
        </ul>
      )}

      <AssignPlanDialog open={assigning} onClose={closeAssign} studentId={studentId} onDone={changed} />
      <PaymentDialog open={paying !== null} onClose={closePay} studentId={studentId} studentName={studentName} memberships={payable} defaultMembershipId={paying?.defaultId} onDone={changed} />
      <ConfirmDialog open={toCancel !== null} danger loading={busy} title="¿Cancelar la mensualidad?" confirmLabel="Cancelar mensualidad"
        message="Dejará de contar como deuda y el alumno la verá como cancelada. Los pagos ya registrados se conservan."
        onCancel={closeCancel} onConfirm={() => toCancel && void cancel(toCancel)} />
    </Card>
  );
}
