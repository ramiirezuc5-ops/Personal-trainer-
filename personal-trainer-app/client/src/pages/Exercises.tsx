import { Archive, ArchiveRestore, Dumbbell, Library, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, EmptyState, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { ConfirmDialog, Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { Pagination } from '../components/ui/Pagination';
import { useToast } from '../context/ToastContext';
import { useAsync, useDebounced } from '../hooks/useAsync';
import { ApiError, fieldErrors } from '../services/api';
import { exercisesApi } from '../services/endpoints';
import type { Exercise, ExerciseDifficulty, ExerciseInput, MediaKind, MuscleGroup } from '../types/api';
import { DIFFICULTY_EX_LABEL, MUSCLE_LABEL } from '../utils/format';
import { ExerciseRoutineTabs } from './ExerciseRoutineTabs';
import p from './pages.module.css';

const MUSCLES = Object.entries(MUSCLE_LABEL) as [MuscleGroup, string][];
const DIFFICULTIES = Object.entries(DIFFICULTY_EX_LABEL) as [ExerciseDifficulty, string][];

interface FormProps { initial?: Exercise; onSubmit: (input: ExerciseInput) => Promise<void>; onCancel: () => void }

function ExerciseForm({ initial, onSubmit, onCancel }: FormProps) {
  const [v, setV] = useState({
    name: initial?.name ?? '', muscleGroup: (initial?.muscleGroup ?? '') as MuscleGroup | '', equipment: initial?.equipment ?? '',
    description: initial?.description ?? '', instructions: initial?.instructions ?? '', commonMistakes: initial?.commonMistakes ?? '',
    mediaUrl: initial?.media?.url ?? '', mediaKind: (initial?.media?.kind ?? 'image') as MediaKind,
    difficulty: (initial?.difficulty ?? '') as ExerciseDifficulty | '',
  });
  const [secondary, setSecondary] = useState<MuscleGroup[]>(initial?.secondaryMuscles ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const toggleSecondary = (g: MuscleGroup) => setSecondary((l) => (l.includes(g) ? l.filter((x) => x !== g) : [...l, g]));

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
      secondaryMuscles: secondary.filter((g) => g !== v.muscleGroup),
      difficulty: v.difficulty || null,
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
        <SelectField label="Grupo muscular principal" value={v.muscleGroup} onChange={set('muscleGroup')} error={errors.muscleGroup} required>
          <option value="">Elegí uno</option>
          {MUSCLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <div className={p.span2}>
          <span style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 650, marginBottom: 'var(--space-2)' }}>Músculos secundarios (opcional)</span>
          <div className={p.checkGrid}>
            {MUSCLES.filter(([k]) => k !== v.muscleGroup).map(([k, l]) => (
              <label key={k} className={p.checkItem}><input type="checkbox" checked={secondary.includes(k)} onChange={() => toggleSecondary(k)} /> {l}</label>
            ))}
          </div>
        </div>
        <SelectField label="Nivel de dificultad (opcional)" value={v.difficulty} onChange={set('difficulty')}>
          <option value="">Sin especificar</option>
          {DIFFICULTIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </SelectField>
        <TextField label="Equipamiento" value={v.equipment} onChange={set('equipment')} error={errors.equipment} hint="Ej.: barra, mancuernas, banco, sin equipo." />
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
  const [toDelete, setToDelete] = useState<Exercise | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const closeEditing = useCallback(() => setEditing(null), []);
  const closeArchive = useCallback(() => setToArchive(null), []);
  const closeDelete = useCallback(() => { setToDelete(null); setDeleteBlocked(''); }, []);

  const update = (patch: Record<string, string>) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    Object.entries({ page: '1', ...patch }).forEach(([k, val]) => (val ? next.set(k, val) : next.delete(k)));
    return next;
  }, { replace: true });

  useEffect(() => { if (debouncedQ !== q) update({ q: debouncedQ }); }, [debouncedQ]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data, error, loading, reload } = useAsync(() => exercisesApi.list({ q, muscleGroup: group, archived, page, limit: 24 }), [q, group, archived, page]);
  const filtered = Boolean(q || group);

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    try { await action(); notify(okMessage); reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo completar la acción.', 'danger'); }
    finally { setBusy(false); setToArchive(null); }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setBusy(true);
    try { await exercisesApi.remove(toDelete._id); notify('Ejercicio eliminado.'); closeDelete(); reload(); }
    catch (err) {
      if (err instanceof ApiError && err.code === 'EXERCISE_IN_USE') setDeleteBlocked(err.message);
      else { notify(err instanceof ApiError ? err.message : 'No se pudo eliminar.', 'danger'); closeDelete(); }
    } finally { setBusy(false); }
  }

  async function importBase() {
    setImporting(true);
    try {
      const r = await exercisesApi.importBase();
      notify(r.created > 0 ? `Se agregaron ${r.created} ejercicios a tu catálogo.${r.skipped > 0 ? ` ${r.skipped} ya los tenías.` : ''}` : 'Ya tenías todos los ejercicios de la biblioteca base.');
      reload();
    } catch (err) { notify(err instanceof ApiError ? err.message : 'No pudimos cargar la biblioteca.', 'danger'); }
    finally { setImporting(false); }
  }

  return (
    <>
      <ExerciseRoutineTabs />
      <PageHeader title="Ejercicios" description="Tu catálogo de ejercicios. Desde acá los elegís al armar las rutinas." actions={(
        <>
          <Button variant="secondary" icon={<Library size={18} aria-hidden="true" />} loading={importing} onClick={() => void importBase()}>Cargar ejercicios base</Button>
          <Button icon={<Plus size={18} aria-hidden="true" />} onClick={() => setEditing('new')}>Nuevo ejercicio</Button>
        </>
      )} />

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
            : <EmptyState icon={<Dumbbell size={24} />} title="Todavía no tenés ejercicios" description="Cargá la biblioteca base, con más de 100 ejercicios listos para usar, y después solo elegís cuáles van en cada rutina. También podés crear los tuyos." action={(
              <div className={p.rowActions}>
                <Button icon={<Library size={18} aria-hidden="true" />} loading={importing} onClick={() => void importBase()}>Cargar ejercicios base</Button>
                <Button variant="secondary" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setEditing('new')}>Crear uno propio</Button>
              </div>
            )} />}
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className={p.exGrid} aria-busy={loading}>
            {data.items.map((ex) => (
              <Card key={ex._id} className={p.exCard}>
                <div className={p.exCardHead}>
                  <span className={p.exCardName}>{ex.name}</span>
                  {ex.archived && <Badge tone="neutral">Archivado</Badge>}
                </div>
                <div className={p.exCardMeta}>
                  <Badge>{MUSCLE_LABEL[ex.muscleGroup]}</Badge>
                  {ex.secondaryMuscles.map((m) => <Badge key={m} tone="neutral">{MUSCLE_LABEL[m]}</Badge>)}
                  {ex.difficulty && <Badge tone="info">{DIFFICULTY_EX_LABEL[ex.difficulty]}</Badge>}
                </div>
                {ex.equipment && <span className={p.muted}>{ex.equipment}</span>}
                {ex.description && <p className={p.exCardDesc}>{ex.description}</p>}
                <div className={p.exCardActions}>
                  <Button size="sm" variant="secondary" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEditing(ex)} aria-label={`Editar ${ex.name}`}>Editar</Button>
                  {ex.archived
                    ? <Button size="sm" variant="secondary" icon={<ArchiveRestore size={16} aria-hidden="true" />} loading={busy} onClick={() => void run(() => exercisesApi.restore(ex._id), 'Ejercicio restaurado.')} aria-label={`Restaurar ${ex.name}`}>Restaurar</Button>
                    : <Button size="sm" variant="ghost" icon={<Archive size={16} aria-hidden="true" />} onClick={() => setToArchive(ex)} aria-label={`Archivar ${ex.name}`}>Archivar</Button>}
                  <Button size="sm" variant="ghost" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setToDelete(ex)} aria-label={`Eliminar ${ex.name}`}>Eliminar</Button>
                </div>
              </Card>
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

      <ConfirmDialog open={toDelete !== null} danger loading={busy} title="¿Eliminar ejercicio?" confirmLabel="Eliminar definitivamente"
        message={deleteBlocked
          ? <Alert tone="danger">{deleteBlocked}</Alert>
          : <>Esta acción no se puede deshacer. {toDelete?.name} se borra por completo del catálogo.</>}
        onCancel={closeDelete} onConfirm={() => void confirmDelete()} />
    </>
  );
}
