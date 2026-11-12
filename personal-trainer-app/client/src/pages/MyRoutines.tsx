import { ClipboardList, Wallet, TrendingUp } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Card, StatCard } from '../components/ui/Card';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { useAsync } from '../hooks/useAsync';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { meApi } from '../services/endpoints';
import { currentMembership, pendingMemberships } from '../utils/billing';
import { DAY_LABEL, DAY_ORDER, formatCalendarDate, formatDate, MEMBERSHIP_LABEL, money, ROUTINE_STATUS_LABEL } from '../utils/format';
import { ROUTINE_TONE } from './Routines';
import p from './pages.module.css';

const DAYS_WINDOW = 28;

export default function MyRoutines() {
  const routines = useAsync(() => meApi.routines(), []);
  const range = useMemo(() => ({ from: new Date(Date.now() - DAYS_WINDOW * 86_400_000).toISOString(), to: new Date().toISOString() }), []);
  const compliance = useAsync(() => meApi.compliance(range.from, range.to), [range]);
  const workouts = useAsync(() => meApi.workouts({ limit: 8 }), []);
  const billing = useAsync(() => meApi.billing(), []);

  const refreshAll = useCallback(() => { routines.reload(); compliance.reload(); workouts.reload(); billing.reload(); }, [routines.reload, compliance.reload, workouts.reload, billing.reload]); // eslint-disable-line react-hooks/exhaustive-deps
  useRefreshOnFocus(refreshAll);

  const c = compliance.data;
  const percentage = c?.percentage;
  const membership = billing.data ? currentMembership(billing.data.memberships) : null;
  const pending = billing.data ? pendingMemberships(billing.data.memberships) : [];
  const pendingTotal = pending.reduce((sum, m) => sum + m.due, 0);

  return (
    <>
      <PageHeader title="Mi rutina" description="Tus rutinas y los entrenamientos que registraste." />

      <div className={p.statGrid}>
        <StatCard
          label={`Cumplimiento (últimos ${DAYS_WINDOW} días)`}
          icon={<TrendingUp size={18} />}
          value={percentage != null ? `${percentage}%` : '—'}
          hint={c ? (percentage != null ? `${c.completed} de ${c.expected} entrenamientos esperados. Es un valor orientativo.` : 'Se calcula cuando tengas una rutina activa.') : undefined}
        />
        <StatCard label={`Entrenamientos (últimos ${DAYS_WINDOW} días)`} value={c ? c.completed : '—'} />
        <StatCard
          label="Mensualidad"
          icon={<Wallet size={18} />}
          value={membership ? MEMBERSHIP_LABEL[membership.status] : '—'}
          hint={billing.data ? <Link to="/mis-pagos">{pendingTotal > 0 ? `Saldo pendiente ${money(pendingTotal, pending[0]?.priceSnapshot.currency)}` : membership ? `Vence ${formatDate(membership.endDate)}` : 'Ver detalle'}</Link> : undefined}
        />
      </div>

      {routines.loading && !routines.data && <LoadingBlock label="Cargando tus rutinas…" />}
      {routines.error != null && !routines.data && <ErrorState error={routines.error} onRetry={routines.reload} />}

      {routines.data && routines.data.length === 0 && (
        <div className={p.listCard}>
          <EmptyState icon={<ClipboardList size={24} />} title="Todavía no tenés una rutina" description="Cuando tu entrenador te asigne una, la vas a ver acá y vas a poder registrar tus entrenamientos." />
        </div>
      )}

      {routines.data && routines.data.length > 0 && (
        <div className={p.listCard}>
          {routines.data.map((r) => {
            const days = [...r.days].sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek)).map((d) => DAY_LABEL[d.dayOfWeek]).join(', ');
            return (
              <Link key={r._id} to={`/mi-rutina/${r._id}`} className={p.row}>
                <div className={p.rowMain}>
                  <span className={p.rowName}>{r.name}</span>
                  <span className={p.rowMeta}><span>{days}</span>{r.goal && <span>· {r.goal}</span>}</span>
                </div>
                <div className={p.rowMeta}>
                  <span>Desde {formatCalendarDate(r.startDate)}</span>
                  <Badge tone={ROUTINE_TONE[r.status]}>{ROUTINE_STATUS_LABEL[r.status]}</Badge>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Card title="Últimos entrenamientos">
          {workouts.loading && !workouts.data && <LoadingBlock label="Cargando…" />}
          {workouts.error != null && !workouts.data && <ErrorState error={workouts.error} onRetry={workouts.reload} />}
          {workouts.data && workouts.data.items.length === 0 && <p className={p.empty}>Todavía no registraste entrenamientos. Entrá a tu rutina y tocá «Registrar entrenamiento» en el día que hiciste.</p>}
          {workouts.data && workouts.data.items.length > 0 && (
            <ul className={p.list}>
              {workouts.data.items.map((w) => {
                const done = w.exercises.filter((e) => e.completed).length;
                return (
                  <li key={w._id} className={p.item}>
                    <div className={p.itemMain}>
                      <span className={p.itemTitle}>{formatDate(w.performedAt)} · {w.routine?.name ?? 'Rutina'}</span>
                      <span className={p.muted}>{done} de {w.exercises.length} ejercicios{w.durationMinutes ? ` · ${w.durationMinutes} min` : ''}{w.notes ? ` · ${w.notes}` : ''}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
