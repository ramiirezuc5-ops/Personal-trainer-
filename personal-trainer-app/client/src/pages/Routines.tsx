import { ClipboardList, Plus, Search } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, type Tone } from '../components/ui/Badge';
import { Button, LinkButton } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { SelectField } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { useAsync } from '../hooks/useAsync';
import { routinesApi, studentsApi } from '../services/endpoints';
import type { RoutineStatus } from '../types/api';
import { DIFFICULTY_LABEL, formatCalendarDate, ROUTINE_STATUS_LABEL } from '../utils/format';
import p from './pages.module.css';

export const ROUTINE_TONE: Record<RoutineStatus, Tone> = { borrador: 'neutral', activa: 'success', finalizada: 'info', archivada: 'neutral' };

export default function Routines() {
  const [params, setParams] = useSearchParams();
  const student = params.get('alumno') ?? '';
  const status = params.get('estado') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const update = (patch: Record<string, string>) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    Object.entries({ page: '1', ...patch }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    return next;
  }, { replace: true });

  const students = useAsync(() => studentsApi.list({ limit: 100, sort: 'name' }), []);
  const { data, error, loading, reload } = useAsync(() => routinesApi.list({ student, status, page, limit: 15 }), [student, status, page]);
  const names = useMemo(() => new Map((students.data?.items ?? []).map((s) => [s.id, `${s.lastName}, ${s.firstName}`])), [students.data]);
  const filtered = Boolean(student || status);
  const newHref = student ? `/rutinas/nueva?alumno=${student}` : '/rutinas/nueva';

  return (
    <>
      <PageHeader title="Rutinas" description="Las rutinas que armaste para tus alumnos." actions={<LinkButton to={newHref} icon={<Plus size={18} aria-hidden="true" />}>Nueva rutina</LinkButton>} />

      <div className={p.filters2} role="search">
        <SelectField label="Alumno" value={student} onChange={(e) => update({ alumno: e.target.value })}>
          <option value="">Todos</option>
          {(students.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.lastName}, {s.firstName}</option>)}
        </SelectField>
        <SelectField label="Estado" value={status} onChange={(e) => update({ estado: e.target.value })}>
          <option value="">Todos</option>
          {Object.entries(ROUTINE_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
      </div>

      {loading && !data && <LoadingBlock label="Cargando rutinas…" />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}

      {data && data.items.length === 0 && (
        <div className={p.listCard}>
          {filtered
            ? <EmptyState icon={<Search size={24} />} title="Sin resultados" description="Ninguna rutina coincide con los filtros." action={<Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Limpiar filtros</Button>} />
            : <EmptyState icon={<ClipboardList size={24} />} title="Todavía no armaste rutinas" description="Elegí un alumno y armá su primera rutina con los ejercicios de tu catálogo." action={<LinkButton to="/rutinas/nueva" icon={<Plus size={18} aria-hidden="true" />}>Crear rutina</LinkButton>} />}
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={p.listCard} aria-busy={loading}>
            {data.items.map((r) => (
              <Link key={r._id} to={`/rutinas/${r._id}`} className={p.row}>
                <div className={p.rowMain}>
                  <span className={p.rowName}>{r.name}</span>
                  <span className={p.rowMeta}><span>{names.get(r.student) ?? 'Alumno'}</span>{r.goal && <span>· {r.goal}</span>}</span>
                </div>
                <div className={p.rowMeta}>
                  <span>{r.dayCount} {r.dayCount === 1 ? 'día' : 'días'}</span>
                  <span>Dificultad {DIFFICULTY_LABEL[r.difficulty].toLowerCase()}</span>
                  <span>Desde {formatCalendarDate(r.startDate)}</span>
                  <Badge tone={ROUTINE_TONE[r.status]}>{ROUTINE_STATUS_LABEL[r.status]}</Badge>
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(n) => update({ page: String(n) })} />
        </>
      )}
    </>
  );
}
