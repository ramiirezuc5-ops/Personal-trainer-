import { Archive, ArchiveRestore, Dumbbell, Pencil, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../context/ToastContext';
import { useAsync, useDebounced } from '../hooks/useAsync';
import { ApiError, fieldErrors } from '../services/api';
import { exercisesApi } from '../services/endpoints';
import type { Exercise, ExerciseInput, MediaKind, MuscleGroup } from '../types/api';
import { MUSCLE_LABEL } from '../utils/format';
import p from './pages.module.css';

const MUSCLES = Object.entries(MUSCLE_LABEL) as [MuscleGroup, string][];

interface FormProps { initial?: Exercise; onSubmit: (input: ExerciseInput) => Promise<void>; onCancel: () => void }

function ExerciseForm({ initial, onSubmit, onCancel }: FormProps) {
  const [v, setV] = useState({
    name: initial?.name ?? '', muscleGroup: (initial?.muscleGroup ?? '') as MuscleGroup | '', equipment: initial?.equipment ?? '',
    description: initial?.description ?? '', instructions: initial?.instructions ?? '', commonMistakes: initial?.commonMistakes ?? '',
    mediaUrl: initial?.media?.url ?? '', mediaKind: (initial?.media?.kind ?? 'image') as MediaKind,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (v.name.trim().length < 2) next.name = 'Ingresá el nombre (mínimo 2 letras).';
    if (!v.muscleGroup) next.muscleGroup = 'Elegí el grupo muscular.';
    if (v.mediaUrl.trim() && !/^https?:\/\//i.test(v.mediaUrl.trim())) next['media.url'] = 'El enlace debe empezar con http:// o https://';
    setErrors(next); setServerError('');
    if (Object.keys(next).length || !v.muscleGroup) return;

    const input: ExerciseInput = {
      name: v.name.trim(), muscleGroup: v.muscleGroup, equipment: v.equipment.trim(), description: v.description.trim(),
      instructions: v.instructions.trim(), commonMistakes: v.commonMistakes.trim(),
      ...(v.mediaUrl.trim() ? { media: { url: v.mediaUrl.trim(), kind: v.mediaKind } } : {}),
    };
    setLoading(true);
    try { await onSubmit(input); }
    catch (err) {
      const fe = fieldErrors(err);
      if (err instanceof ApiError && err.code === 'DUPLICATE_EXERCISE') setErrors({ name: 'Ya tenés un ejercicio con ese nombre.' });
      else if (Object.keys(fe).length) setErrors(fe);
      else setServerError(err instanceof ApiError ? err.message : 'No pudimos guardar el ejercicio.');
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      {serverError && <div style={{ marginBottom: 'var(--space-4)' }}><Alert tone="danger">{serverError}</Alert></div>}
      <div className={p.formGrid}>
        <TextField label="Nombre" value={v.name} onChange={set('name')} error={errors.name} autoComplete="off" required />
        <SelectField label="Grupo muscular" value={v.muscleGroup} onChange={set('muscleGroup')} error={errors.muscleGroup} required>
          <option value="">Elegí uno</option>
          {MUSCLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <div className={p.span2}><TextField label="Equipamiento" value={v.equipment} onChange={set('equipment')} error={errors.equipment} hint="Ej.: barra, mancuernas, banco, sin equipo." /></div>
        <div className={p.span2}><TextAreaField label="Descripción" value={v.description} onChange={set('description')} error={errors.description} /></div>
        <div className={p.span2}><TextAreaField label="Cómo se hace" value={v.instructions} onChange={set('instructions')} error={errors.instructions} hint="Lo ve el alumno en su rutina." /></div>
        <div className={p.span2}><TextAreaField label="Errores comunes" value={v.commonMistakes} onChange={set('commonMistakes')} error={errors.commonMistakes} /></div>
        <TextField label="Enlace a imagen o video" type="url" value={v.mediaUrl} onChange={set('mediaUrl')} error={errors['media.url'] ?? errors.media} hint="Opcional. Pegá un enlace https://…" />
        <SelectField label="Tipo de enlace" value={v.mediaKind} onChange={set('mediaKind')}>
          <option value="image">Imagen</option><option value="video">Video</option>
        </SelectField>
      </div>
      <div className={p.formActions}>
        <Button type="submit" loading={loading}>{initial ? 'Guardar cambios' : 'Crear ejercicio'}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancelar</Button>
      </div>
    </form>
  );
}

export default function Exercises() {
  const { notify } = useToast();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const group = params.get('grupo') ?? '';
  const archived = params.get('archivados') === '1';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [qInput, setQInput] = useState(q);
  const debouncedQ = useDebounced(qInput, 300);
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [toArchive, setToArchive] = useState<Exercise | null>(null);
  const [busy, setBusy] = useState(false);
  // Callbacks estables: el Modal vuelve a enfocar el primer campo si cambia onClose.
  const closeEditing = useCallback(() => setEditing(null), []);
  const closeArchive = useCallback(() => setToArchive(null), []);

  const update = (patch: Record<string, string>) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    Object.entries({ page: '1', ...patch }).forEach(([k, val]) => (val ? next.set(k, val) : next.delete(k)));
    return next;
  }, { replace: true });

  useEffect(() => { if (debouncedQ !== q) update({ q: debouncedQ }); }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, error, loading, reload } = useAsync(() => exercisesApi.list({ q, muscleGroup: group, archived, page, limit: 20 }), [q, group, archived, page]);
  const filtered = Boolean(q || group);

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    try { await action(); notify(okMessage); reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo completar la acción.', 'danger'); }
    finally { setBusy(false); setToArchive(null); }
  }

  return (
    <>
      <PageHeader title="Ejercicios" description="Tu catálogo de ejercicios. Desde acá los elegís al armar las rutinas." actions={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setEditing('new')}>Nuevo ejercicio</Button>} />

      <div className={p.filters3} role="search">
        <TextField label="Buscar" type="search" value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Nombre del ejercicio" />
        <SelectField label="Grupo muscular" value={group} onChange={(e) => update({ grupo: e.target.value })}>
          <option value="">Todos</option>{MUSCLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <SelectField label="Mostrar" value={archived ? '1' : ''} onChange={(e) => update({ archivados: e.target.value })}>
          <option value="">Activos</option><option value="1">Archivados</option>
        </SelectField>
      </div>

      {loading && !data && <LoadingBlock label="Cargando ejercicios…" />}
      {error != null && !data && <ErrorState error={error} onRetry={reload} />}

      {data && data.items.length === 0 && (
        <div className={p.listCard}>
          {filtered || archived
            ? <EmptyState icon={<Search size={24} />} title="Sin resultados" description={archived && !filtered ? 'No tenés ejercicios archivados.' : 'Ningún ejercicio coincide con la búsqueda o los filtros.'} action={<Button variant="secondary" onClick={() => { setQInput(''); setParams({}, { replace: true }); }}>Limpiar filtros</Button>} />
            : <EmptyState icon={<Dumbbell size={24} />} title="Todavía no cargaste ejercicios" description="Creá los ejercicios que usás habitualmente. Después los elegís al armar cada rutina." action={<Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setEditing('new')}>Crear el primero</Button>} />}
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={p.listCard} aria-busy={loading}>
            {data.items.map((ex) => (
              <div key={ex._id} className={p.rowStatic}>
                <div className={p.rowMain}>
                  <span className={p.rowName}>{ex.name}</span>
                  <span className={p.rowMeta}><Badge>{MUSCLE_LABEL[ex.muscleGroup]}</Badge>{ex.equipment && <span>{ex.equipment}</span>}</span>
                </div>
                <div className={p.rowActions}>
                  <Button size="sm" variant="secondary" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEditing(ex)} aria-label={`Editar ${ex.name}`}>Editar</Button>
                  {ex.archived
                    ? <Button size="sm" variant="secondary" icon={<ArchiveRestore size={16} aria-hidden="true" />} loading={busy} onClick={() => void run(() => exercisesApi.restore(ex._id), 'Ejercicio restaurado.')} aria-label={`Restaurar ${ex.name}`}>Restaurar</Button>
                    : <Button size="sm" variant="ghost" icon={<Archive size={16} aria-hidden="true" />} onClick={() => setToArchive(ex)} aria-label={`Archivar ${ex.name}`}>Archivar</Button>}
                </div>
              </div>
            ))}
          </div>
          <Pagination page={data.page} pages={data.pages} total={data.total} onChange={(n) => update({ page: String(n) })} />
        </>
      )}

      <Modal open={editing !== null} title={editing === 'new' ? 'Nuevo ejercicio' : 'Editar ejercicio'} onClose={closeEditing}>
        {editing !== null && (
          <ExerciseForm
            initial={editing === 'new' ? undefined : editing}
            onCancel={closeEditing}
            onSubmit={async (input) => {
              if (editing === 'new') { await exercisesApi.create(input); notify('Ejercicio creado.'); }
              else { await exercisesApi.update(editing._id, input); notify('Cambios guardados.'); }
              setEditing(null); reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog open={toArchive !== null} loading={busy} title="¿Archivar ejercicio?" confirmLabel="Archivar"
        message={<>{toArchive?.name} dejará de aparecer al armar rutinas nuevas. <strong>No se borra</strong>: las rutinas que ya lo usan lo siguen mostrando y podés restaurarlo cuando quieras.</>}
        onCancel={closeArchive} onConfirm={() => toArchive && void run(() => exercisesApi.archive(toArchive._id), 'Ejercicio archivado.')} />
    </>
  );
}
