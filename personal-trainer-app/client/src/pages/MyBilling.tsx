import { CheckCircle2, Wallet } from 'lucide-react';
import { Badge, type Tone } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { useAsync } from '../hooks/useAsync';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { meApi } from '../services/endpoints';
import type { MembershipStatus } from '../types/api';
import { currentMembership, daysUntil, pendingMemberships } from '../utils/billing';
import { formatDate, MEMBERSHIP_LABEL, money, PAYMENT_METHOD_LABEL } from '../utils/format';
import p from './pages.module.css';

const TONE: Record<MembershipStatus, Tone> = { pendiente: 'info', activa: 'success', vencida: 'danger', cancelada: 'neutral' };

function dueText(status: MembershipStatus, endDate: string): string {
  if (status === 'cancelada') return 'Esta mensualidad fue cancelada.';
  if (status === 'pendiente') return 'Todavía no comenzó.';
  const d = daysUntil(endDate);
  if (d < 0) return `Venció hace ${-d} ${-d === 1 ? 'día' : 'días'}.`;
  if (d === 0) return 'Vence hoy.';
  return `Vence en ${d} ${d === 1 ? 'día' : 'días'}.`;
}

export default function MyBilling() {
  const { data, error, loading, reload } = useAsync(() => meApi.billing(), []);
  useRefreshOnFocus(reload);

  if (loading && !data) return <LoadingBlock label="Cargando tu mensualidad…" />;
  if (error != null && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const current = currentMembership(data.memberships);
  const pending = pendingMemberships(data.memberships);

  return (
    <>
      <PageHeader title="Mi mensualidad" description="El estado de tu plan y tus pagos. Es solo de consulta." />

      <div className={p.stack}>
        {!current ? (
          <div className={p.listCard}>
            <EmptyState icon={<Wallet size={24} />} title="Todavía no tenés una mensualidad" description="Cuando tu entrenador te asigne un plan, lo vas a ver acá." />
          </div>
        ) : (
          <Card title="Mensualidad actual" actions={<Badge tone={TONE[current.status]}>{MEMBERSHIP_LABEL[current.status]}</Badge>}>
            <dl className={p.dl}>
              <div><dt>Plan</dt><dd>{current.plan?.name ?? 'Plan'}</dd></div>
              <div><dt>Período</dt><dd>{formatDate(current.startDate)} al {formatDate(current.endDate)}</dd></div>
              <div><dt>Estado</dt><dd>{dueText(current.status, current.endDate)}</dd></div>
              <div><dt>Precio</dt><dd>{money(current.priceSnapshot.amount, current.priceSnapshot.currency)}</dd></div>
              {current.discount && current.discount.amount > 0 && <div><dt>Descuento</dt><dd>−{money(current.discount.amount, current.priceSnapshot.currency)}{current.discount.reason ? ` · ${current.discount.reason}` : ''}</dd></div>}
              <div><dt>Pagado</dt><dd>{money(current.paid, current.priceSnapshot.currency)}</dd></div>
            </dl>
          </Card>
        )}

        <Card title="Pagos pendientes">
          {pending.length === 0 ? (
            <p className={`${p.dueAmount} ${p.dueOk}`} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', margin: 0 }}>
              <CheckCircle2 size={22} aria-hidden="true" /> Estás al día
            </p>
          ) : (
            <ul className={p.list}>
              {pending.map((m) => (
                <li key={m._id} className={p.item}>
                  <div className={p.itemMain}>
                    <span className={p.itemTitle}>{m.plan?.name ?? 'Plan'}</span>
                    <span className={p.muted}>{formatDate(m.startDate)} al {formatDate(m.endDate)} · pagaste {money(m.paid, m.priceSnapshot.currency)} de {money(m.owed, m.priceSnapshot.currency)}</span>
                  </div>
                  <span className={`${p.dueAmount} ${p.dueWarn}`}>{money(m.due, m.priceSnapshot.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Historial de pagos">
          {data.payments.length === 0 ? (
            <p className={p.empty}>Todavía no hay pagos registrados.</p>
          ) : (
            <ul className={p.list}>
              {data.payments.map((pay) => (
                <li key={pay._id} className={p.item}>
                  <div className={`${p.itemMain} ${pay.status === 'anulado' ? p.mutedRow : ''}`}>
                    <span className={p.itemTitle}>{formatDate(pay.paidAt)} · {PAYMENT_METHOD_LABEL[pay.method]}</span>
                    {pay.periodStart && pay.periodEnd && <span className={p.muted}>Período {formatDate(pay.periodStart)} al {formatDate(pay.periodEnd)}</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {pay.status === 'anulado' && <Badge tone="neutral">Anulado</Badge>}
                    <span className={`${p.amount} ${pay.status === 'anulado' ? p.mutedRow : ''}`}>{money(pay.amount, pay.currency)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Alert tone="info">Para pagar o aclarar un movimiento, hablá con tu entrenador. Desde acá no se pueden hacer pagos.</Alert>
      </div>
    </>
  );
}
