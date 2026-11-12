import { Package, Pencil, Plus } from 'lucide-react';
import { useCallback, useState, type FormEvent } from 'react';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError, fieldErrors } from '../services/api';
import { billingApi } from '../services/endpoints';
import type { Plan, PlanInput } from '../types/api';
import { money } from '../utils/format';
import p from './pages.module.css';

const isInt = (s: string) => /^\d+$/.test(s.trim());
const DURATIONS = [{ v: '7', l: 'Semanal (7 días)' }, { v: '30', l: 'Mensual (30 días)' }, { v: '90', l: 'Trimestral (90 días)' }, { v: '365', l: 'Anual (365 días)' }];

function PlanForm({ initial, onSubmit, onCancel }: { initial?: Plan; onSubmit: (input: PlanInput) => Promise<void>; onCancel: () => void }) {
  const [v, setV] = useState({
    name: initial?.name ?? '', description: initial?.description ?? '', price: initial ? String(initial.price) : '',
    days: initial ? String(initial.durationDays) : '30', sessions: initial?.sessionsIncluded != null ? String(initial.sessionsIncluded) : '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const preset = DURATIONS.some((d) => d.v === v.days);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const price = Number(v.price.replace(',', '.'));
    if (v.name.trim().length < 2) return setError('Escribí el nombre del plan (mínimo 2 letras).');
    if (v.price.trim() === '' || Number.isNaN(price) || price < 0) return setError('Ingresá un precio válido.');
    if (!isInt(v.days) || Number(v.days) < 1 || Number(v.days) > 730) return setError('La duración debe ser entre 1 y 730 días.');
    if (v.sessions.trim() && !isInt(v.sessions)) return setError('Las sesiones incluidas deben ser un número entero.');
    setError(''); setSaving(true);
    try {
      await onSubmit({
        name: v.name.trim(), description: v.description.trim(), price, durationDays: Number(v.days),
        // Al editar, vaciar el campo lo quita (null); al crear, simplemente no se envía.
        ...(v.sessions.trim() ? { sessionsIncluded: Number(v.sessions) } : initial ? { sessionsIncluded: null } : {}),
      });
    } catch (err) {
      const fe = Object.values(fieldErrors(err));
      setError(fe.length ? fe.join(' ') : err instanceof ApiError ? err.message : 'No pudimos guardar el plan.');
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className={p.formStack}>
      {error && <Alert tone="danger">{error}</Alert>}
      <TextField label="Nombre" value={v.name} onChange={set('name')} placeholder="Ej.: Mensual 3 veces por semana" autoComplete="off" required />
      <TextAreaField label="Descripción (opcional)" value={v.description} onChange={set('description')} maxLength={300} />
      <div className={p.formGrid}>
        <TextField label="Precio" type="number" inputMode="decimal" min={0} step="any" value={v.price} onChange={set('price')} required />
        <SelectField label="Duración" value={preset ? v.days : 'otra'} onChange={(e) => setV((s) => ({ ...s, days: e.target.value === 'otra' ? '' : e.target.value }))}>
          {DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
          <option value="otra">Otra duración…</option>
        </SelectField>
        {!preset && <TextField label="Duración en días" type="number" inputMode="numeric" min={1} max={730} value={v.days} onChange={set('days')} required />}
        <TextField label="Sesiones incluidas (opcional)" type="number" inputMode="numeric" min={0} value={v.sessions} onChange={set('sessions')} hint="Déjalo vacío si no hay límite." />
      </div>
      <div className={p.formActions}>
        <Button type="submit" loading={saving}>{initial ? 'Guardar cambios' : 'Crear plan'}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Button>
      </div>
    </form>
  );
}

export default function Plans() {
  const { notify } = useToast();
  const [showInactive, setShowInactive] = useState(false);
  const { data, error, loading, reload } = useAsync(() => billingApi.plans(showInactive), [showInactive]);
  const [editing, setEditing] = useState<Plan | 'new' | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const closeEditing = useCallback(() => setEditing(null), []);

  async function toggle(plan: Plan) {
    setBusy(plan._id);
    try { await billingApi.updatePlan(plan._id, { active: !plan.active }); notify(plan.active ? 'Plan desactivado.' : 'Plan activado.'); reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo cambiar el plan.', 'danger'); }
    finally { setBusy(null); }
  }

  return (
    <>
      <PageHeader title="Planes" description="Los planes que ofrecés. Al asignarlos a un alumno se crea su mensualidad."
        actions={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setEditing('new')}>Nuevo plan</Button>} />

      <div style={{ marginBottom: 'var(--space-4)', maxWidth: 260 }}>
        <SelectField label="Mostrar" value={showInactive ? '1' : ''} onChange={(e) => setShowInactive(e.target.value === '1')}>
          <option value="">Solo activos</option><option value="1">Activos e inactivos</option>
        </SelectField>
      </div>

      {loading && !data && <LoadingBlock label="Cargando planes…" />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}

      {data && data.length === 0 && (
        <div className={p.listCard}>
          <EmptyState icon={<Package size={24} />} title="Todavía no creaste planes" description="Creá, por ejemplo, un plan mensual. Después podés asignarlo a cada alumno desde su ficha." action={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setEditing('new')}>Crear el primero</Button>} />
        </div>
      )}

      {data && data.length > 0 && (
        <div className={p.listCard}>
          {data.map((plan) => (
            <div key={plan._id} className={p.rowStatic}>
              <div className={p.rowMain}>
                <span className={p.rowName}>{plan.name} {!plan.active && <Badge tone="neutral">Inactivo</Badge>}</span>
                <span className={p.rowMeta}>
                  <span>{money(plan.price, plan.currency)}</span><span>· {plan.durationDays} días</span>
                  {plan.sessionsIncluded != null && <span>· {plan.sessionsIncluded} sesiones</span>}
                  {plan.description && <span>· {plan.description}</span>}
                </span>
              </div>
              <div className={p.rowActions}>
                <Button size="sm" variant="secondary" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEditing(plan)} aria-label={`Editar ${plan.name}`}>Editar</Button>
                <Button size="sm" variant="ghost" loading={busy === plan._id} onClick={() => void toggle(plan)} aria-label={`${plan.active ? 'Desactivar' : 'Activar'} ${plan.name}`}>{plan.active ? 'Desactivar' : 'Activar'}</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Nuevo plan' : 'Editar plan'} onClose={closeEditing}>
        {editing !== null && (
          <PlanForm initial={editing === 'new' ? undefined : editing} onCancel={closeEditing}
            onSubmit={async (input) => {
              if (editing === 'new') { await billingApi.createPlan(input); notify('Plan creado.'); }
              else { await billingApi.updatePlan(editing._id, input); notify('Cambios guardados. Las mensualidades ya asignadas no cambian.'); }
              setEditing(null); reload();
            }} />
        )}
      </Modal>
    </>
  );
}
