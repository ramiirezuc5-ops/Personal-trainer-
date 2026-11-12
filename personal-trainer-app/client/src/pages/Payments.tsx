import { CircleDollarSign, Wallet } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button, LinkButton } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { useAsync } from '../hooks/useAsync';
import { billingApi } from '../services/endpoints';
import type { PendingRow } from '../types/api';
import { formatDate, money, PAYMENT_METHOD_LABEL } from '../utils/format';
import { PaymentDialog, VoidPaymentDialog } from './BillingDialogs';
import p from './pages.module.css';

const byCurrency = (rows: PendingRow[]) => {
  const totals = new Map<string, number>();
  rows.forEach((r) => totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.due));
  return [...totals.entries()];
};

export default function Payments() {
  const monthStart = useMemo(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); }, []);
  const [page, setPage] = useState(1);
  const pending = useAsync(() => billingApi.pending(), []);
  const summary = useAsync(() => billingApi.summary(monthStart), [monthStart]);
  const history = useAsync(() => billingApi.payments({ page, limit: 15 }), [page]);
  const [paying, setPaying] = useState<PendingRow | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const closePay = useCallback(() => setPaying(null), []);
  const closeVoid = useCallback(() => setVoiding(null), []);
  const refresh = useCallback(() => { pending.reload(); summary.reload(); history.reload(); }, [pending.reload, summary.reload, history.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const owed = pending.data ? byCurrency(pending.data) : [];
  const debtors = pending.data ? new Set(pending.data.map((r) => r.student.id)).size : 0;
  const collected = summary.data?.totals ?? [];

  return (
    <>
      <PageHeader title="Pagos" description="Lo que cobraste y lo que te deben. Los alumnos ven lo mismo en su app."
        actions={<LinkButton to="/planes" variant="secondary">Planes</LinkButton>} />

      <div className={p.statGrid}>
        <StatCard label="Cobrado este mes" icon={<CircleDollarSign size={18} />}
          value={summary.data ? (collected.length ? collected.map((t) => money(t.total, t.currency)).join(' · ') : money(0)) : '—'} />
        <StatCard label="Saldo pendiente" icon={<Wallet size={18} />}
          value={pending.data ? (owed.length ? owed.map(([c, t]) => money(t, c)).join(' · ') : money(0)) : '—'}
          hint={pending.data ? `${pending.data.length} ${pending.data.length === 1 ? 'mensualidad' : 'mensualidades'}` : undefined} />
        <StatCard label="Alumnos con deuda" value={pending.data ? debtors : '—'} />
      </div>

      <div className={p.stack}>
        <Card title="Pagos pendientes">
          {pending.loading && !pending.data && <LoadingBlock label="Cargando…" />}
          {pending.error != null && !pending.data && <ErrorState error={pending.error} onRetry={pending.reload} />}
          {pending.data && pending.data.length === 0 && <p className={p.empty}>Nadie te debe nada. Todo al día.</p>}
          {pending.data && pending.data.length > 0 && (
            <ul className={p.list}>
              {pending.data.map((r) => (
                <li key={r._id} className={p.item}>
                  <div className={p.itemMain}>
                    <span className={p.itemTitle}><Link to={`/alumnos/${r.student.id}`}>{r.student.lastName}, {r.student.firstName}</Link> {r.status === 'vencida' && <Badge tone="danger">Vencida</Badge>}</span>
                    <span className={p.muted}>{r.status === 'vencida' ? 'Venció' : 'Vence'} el {formatDate(r.endDate)}</span>
                  </div>
                  <div className={p.rowActions} style={{ alignItems: 'center' }}>
                    <span className={p.amount}>{money(r.due, r.currency)}</span>
                    <Button size="sm" onClick={() => setPaying(r)}>Registrar pago</Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Historial de pagos">
          {history.loading && !history.data && <LoadingBlock label="Cargando…" />}
          {history.error != null && !history.data && <ErrorState error={history.error} onRetry={history.reload} />}
          {history.data && history.data.items.length === 0 && <EmptyState icon={<Wallet size={24} />} title="Todavía no registraste pagos" description="Cuando cobres una mensualidad, registrala desde «Pagos pendientes» o desde la ficha del alumno." />}
          {history.data && history.data.items.length > 0 && (
            <>
              <ul className={p.list}>
                {history.data.items.map((pay) => (
                  <li key={pay._id} className={p.item}>
                    <div className={`${p.itemMain} ${pay.status === 'anulado' ? p.mutedRow : ''}`}>
                      <span className={p.itemTitle}>{pay.student ? `${pay.student.lastName}, ${pay.student.firstName}` : 'Alumno'}</span>
                      <span className={p.muted}>{formatDate(pay.paidAt)} · {PAYMENT_METHOD_LABEL[pay.method]}{pay.notes ? ` · ${pay.notes}` : ''}{pay.voided?.reason ? ` · Anulado: ${pay.voided.reason}` : ''}</span>
                    </div>
                    <div className={p.rowActions} style={{ alignItems: 'center' }}>
                      {pay.status === 'anulado' && <Badge tone="neutral">Anulado</Badge>}
                      <span className={`${p.amount} ${pay.status === 'anulado' ? p.mutedRow : ''}`}>{money(pay.amount, pay.currency)}</span>
                      {pay.status === 'registrado' && <Button size="sm" variant="ghost" onClick={() => setVoiding(pay._id)} aria-label={`Anular el pago de ${pay.student?.lastName ?? 'alumno'}`}>Anular</Button>}
                    </div>
                  </li>
                ))}
              </ul>
              <Pagination page={history.data.page} pages={history.data.pages} total={history.data.total} onChange={setPage} />
            </>
          )}
        </Card>
      </div>

      {paying && (
        <PaymentDialog open onClose={closePay} studentId={paying.student.id} studentName={`${paying.student.firstName} ${paying.student.lastName}`}
          memberships={[{ id: paying._id, label: 'Mensualidad', due: paying.due, currency: paying.currency }]} defaultMembershipId={paying._id} onDone={refresh} />
      )}
      <VoidPaymentDialog paymentId={voiding} onClose={closeVoid} onDone={refresh} />
    </>
  );
}
