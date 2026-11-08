import { Search, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge, type Tone } from '../components/ui/Badge';
import { Button, LinkButton } from '../components/ui/Button';
import { EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { SelectField, TextField } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { useAsync, useDebounced } from '../hooks/useAsync';
import { studentsApi } from '../services/endpoints';
import { formatDate, LEVEL_LABEL, STATUS_LABEL } from '../utils/format';
import p from './pages.module.css';

export const STATUS_TONE: Record<string, Tone> = { active: 'success', pending: 'warning', inactive: 'neutral' };

export default function Students() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = params.get('status') ?? '';
  const level = params.get('level') ?? '';
  const sort = params.get('sort') ?? 'name';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [qInput, setQInput] = useState(q);
  const debouncedQ = useDebounced(qInput, 300);

  const update = (patch: Record<string, string>) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    Object.entries({ page: '1', ...patch }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    return next;
  }, { replace: true });

  useEffect(() => { if (debouncedQ !== q) update({ q: debouncedQ }); }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, error, loading, reload } = useAsync(() => studentsApi.list({ q, status, level, sort, page, limit: 15 }), [q, status, level, sort, page]);
  const filtered = Boolean(q || status || level);

  return (
    <>
      <PageHeader title="Alumnos" description="Buscá, filtrá y entrá a la ficha de cada alumno." actions={<LinkButton to="/alumnos/nuevo" icon={<UserPlus size={18} aria-hidden="true" />}>Nuevo alumno</LinkButton>} />

      <div className={p.filters} role="search">
        <TextField label="Buscar" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Nombre, apellido o correo" />
        <SelectField label="Estado" value={status} onChange={(e) => update({ status: e.target.value })}>
          <option value="">Todos</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <SelectField label="Nivel" value={level} onChange={(e) => update({ level: e.target.value })}>
          <option value="">Todos</option>{Object.entries(LEVEL_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <SelectField label="Ordenar por" value={sort} onChange={(e) => update({ sort: e.target.value === 'name' ? '' : e.target.value })}>
          <option value="name">Apellido</option><option value="recent">Más recientes</option>
        </SelectField>
      </div>

      {loading && !data && <LoadingBlock label="Cargando alumnos…" />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}

      {data && data.items.length === 0 && (
        <div className={p.listCard}>
          {filtered
            ? <EmptyState icon={<Search size={24} />} title="Sin resultados" description="Ningún alumno coincide con la búsqueda o los filtros." action={<Button variant="secondary" onClick={() => { setQInput(''); setParams({}, { replace: true }); }}>Limpiar filtros</Button>} />
            : <EmptyState icon={<Users size={24} />} title="Todavía no tenés alumnos" description="Registrá al primero para empezar a armar sus rutinas y seguir su progreso." action={<LinkButton to="/alumnos/nuevo" icon={<UserPlus size={18} aria-hidden="true" />}>Registrar alumno</LinkButton>} />}
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={p.listCard} aria-busy={loading}>
            {data.items.map((s) => (
              <Link key={s.id} to={`/alumnos/${s.id}`} className={p.row}>
                <div className={p.rowMain}>
                  <span className={p.rowName}>{s.lastName}, {s.firstName}</span>
                  <span className={p.rowMeta}><span>{s.email}</span>{s.goal && <span>· {s.goal}</span>}</span>
                </div>
                <div className={p.rowMeta}>
                  <span>{LEVEL_LABEL[s.experienceLevel]}</span><span>Alta: {formatDate(s.joinedAt)}</span>
                  <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
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
