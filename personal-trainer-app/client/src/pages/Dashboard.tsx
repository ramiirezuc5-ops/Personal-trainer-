import { CalendarDays, CalendarClock, UserPlus, Users, Wallet, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Badge, type Tone } from '../components/ui/Badge';
import { LinkButton } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { SelectField } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { dashboardApi } from '../services/endpoints';
import type { Dashboard as DashboardData } from '../types/api';
import { formatDate, formatTime, monthLabel, money } from '../utils/format';
import p from './pages.module.css';

const APPT_TONE: Record<string, Tone> = { reservado: 'warning', confirmado: 'info', completado: 'success', cancelado: 'danger' };
const tooltipStyle = { background: 'var(--color-surface-3)', border: '1px solid var(--color-border-strong)', borderRadius: 8, color: 'var(--color-text)' };

// Figura accesible: el gráfico es decorativo para lectores de pantalla y se acompaña de un resumen en texto.
function ChartFigure({ label, summary, children }: { label: string; summary: string; children: React.ReactNode }) {
  return (
    <figure style={{ margin: 0 }} aria-label={label}>
      <div className={p.chart} aria-hidden="true">{children}</div>
      <figcaption className="visually-hidden">{summary}</figcaption>
    </figure>
  );
}

function MonthlyBars({ months, values, format, name }: { months: string[]; values: number[]; format?: (n: number) => string; name: string }) {
  const data = months.map((m, i) => ({ label: monthLabel(m), value: values[i] ?? 0 }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} width={48} allowDecimals={false} tickFormatter={format} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--color-surface-2)' }} formatter={(v) => [format ? format(Number(v)) : String(v), name]} />
        <Bar dataKey="value" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Content({ d, name }: { d: DashboardData; name: string }) {
  const [currency, setCurrency] = useState(d.charts.revenueByMonth[0]?.currency ?? 'ARS');
  const series = d.charts.revenueByMonth.find((r) => r.currency === currency);
  const pendingTotals = Object.entries(d.pendingPayments.totals).map(([c, v]) => money(v, c)).join(' · ');
  const revenue = d.revenueThisMonth.map((r) => money(r.total, r.currency)).join(' · ');

  if (d.isEmpty) {
    return (
      <Card>
        <EmptyState icon={<Users size={24} />} title={`Bienvenido, ${name}`} description="Todavía no tenés alumnos. Registrá al primero: le llegará una invitación para activar su cuenta y desde ahí vas a poder seguir su evolución." action={<LinkButton to="/alumnos/nuevo" icon={<UserPlus size={18} aria-hidden="true" />}>Registrar primer alumno</LinkButton>} />
      </Card>
    );
  }

  return (
    <>
      <div className={p.statGrid}>
        <StatCard label="Alumnos activos" value={d.students.active} icon={<Users size={18} />} hint={`${d.students.new30d} nuevos en 30 días${d.students.pending ? ` · ${d.students.pending} sin activar` : ''}`} />
        <StatCard label="Turnos de hoy" value={d.todayAppointments.length} icon={<CalendarDays size={18} />} hint="Según tu zona horaria" />
        <StatCard label="Pagos pendientes" value={d.pendingPayments.count} icon={<Wallet size={18} />} hint={pendingTotals || 'Sin saldos pendientes'} />
        <StatCard label="Ingresos del mes" value={revenue || '—'} icon={<TrendingUp size={18} />} hint="Pagos registrados, sin anulados" />
      </div>

      <div className={p.grid2}>
        <Card title="Turnos de hoy">
          {d.todayAppointments.length === 0 ? <p className={p.empty}>No tenés turnos para hoy.</p> : (
            <ul className={p.list}>{d.todayAppointments.map((a) => (
              <li key={a._id} className={p.item}>
                <div className={p.itemMain}><span className={p.itemTitle}>{a.student ? `${a.student.firstName} ${a.student.lastName}` : 'Alumno'}</span><span className={p.muted}>{formatTime(a.start, d.timezone)} – {formatTime(a.end, d.timezone)} · {a.type}</span></div>
                <Badge tone={APPT_TONE[a.status] ?? 'neutral'}>{a.status}</Badge>
              </li>))}
            </ul>)}
        </Card>

        <Card title="Membresías por vencer (7 días)">
          {d.membershipsDueSoon.length === 0 ? <p className={p.empty}>No hay vencimientos próximos.</p> : (
            <ul className={p.list}>{d.membershipsDueSoon.map((m) => (
              <li key={m.id} className={p.item}>
                <div className={p.itemMain}>{m.student ? <Link to={`/alumnos/${m.student.id}`} className={p.itemTitle}>{m.student.name}</Link> : <span className={p.itemTitle}>Alumno</span>}<span className={p.muted}>Vence el {formatDate(m.endDate, d.timezone)}</span></div>
              </li>))}
            </ul>)}
        </Card>
      </div>

      <div className={p.grid2}>
        <Card title="Alumnos nuevos por mes">
          <ChartFigure label="Alumnos nuevos por mes" summary={d.charts.months.map((m, i) => `${monthLabel(m)}: ${d.charts.newStudentsByMonth[i]}`).join(', ')}>
            <MonthlyBars months={d.charts.months} values={d.charts.newStudentsByMonth} name="Alumnos nuevos" />
          </ChartFigure>
        </Card>
        <Card title="Ingresos por mes" actions={d.charts.revenueByMonth.length > 1 ? <div style={{ width: 120 }}><SelectField label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)}>{d.charts.revenueByMonth.map((r) => <option key={r.currency}>{r.currency}</option>)}</SelectField></div> : undefined}>
          {series ? (
            <ChartFigure label={`Ingresos por mes en ${currency}`} summary={d.charts.months.map((m, i) => `${monthLabel(m)}: ${money(series.values[i] ?? 0, currency)}`).join(', ')}>
              <MonthlyBars months={d.charts.months} values={series.values} name="Ingresos" format={(n) => money(n, currency)} />
            </ChartFigure>
          ) : <p className={p.empty}>Todavía no registraste pagos en los últimos 6 meses.</p>}
        </Card>
      </div>

      <div className={p.grid2}>
        <Card title="Pagos pendientes">
          {d.pendingPayments.items.length === 0 ? <p className={p.empty}>No hay saldos pendientes.</p> : (
            <ul className={p.list}>{d.pendingPayments.items.map((i) => (
              <li key={i._id} className={p.item}>
                <div className={p.itemMain}><Link to={`/alumnos/${i.student.id}`} className={p.itemTitle}>{i.student.firstName} {i.student.lastName}</Link><span className={p.muted}>Membresía hasta {formatDate(i.endDate, d.timezone)}</span></div>
                <span className={p.amount}>{money(i.due, i.currency)}</span>
              </li>))}
            </ul>)}
        </Card>
        <Card title="Actividad reciente">
          {d.recentActivity.length === 0 ? <p className={p.empty}>Todavía no hay actividad.</p> : (
            <ul className={p.list}>{d.recentActivity.map((a, i) => (
              <li key={`${a.type}-${a.at}-${i}`} className={p.item}><div className={p.itemMain}><span>{a.text}</span><span className={p.muted}>{formatDate(a.at, d.timezone)}</span></div><Badge>{a.type}</Badge></li>))}
            </ul>)}
        </Card>
      </div>
    </>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useAsync(() => dashboardApi.get(), []);
  const firstName = user?.name.split(' ')[0] ?? '';
  return (
    <>
      <PageHeader title="Panel" description={data ? `Hola, ${firstName}. ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'full', timeZone: data.timezone }).format(new Date())}` : undefined}
        actions={<LinkButton to="/alumnos/nuevo" icon={<UserPlus size={18} aria-hidden="true" />}>Registrar alumno</LinkButton>} />
      {loading && !data && <LoadingBlock label="Cargando tu panel…" />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}
      {data && <Content d={data} name={firstName} />}
      {data && <p className={p.muted} style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 6 }}><CalendarClock size={14} aria-hidden="true" />Los datos se calculan al abrir el panel con tu información real.</p>}
    </>
  );
}
