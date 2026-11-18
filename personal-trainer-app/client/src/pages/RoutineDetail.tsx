import { Archive, CheckCheck, Copy, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError } from '../services/api';
import { exercisesApi, routinesApi, studentsApi } from '../services/endpoints';
import type { RoutineDetail as Routine, RoutineStatus, StudentDetail } from '../types/api';
import { DAY_LABEL, DAY_ORDER, DIFFICULTY_LABEL, formatCalendarDate, MUSCLE_LABEL, ROUTINE_STATUS_LABEL } from '../utils/format';
import p from './pages.module.css';
import { RoutineForm } from './RoutineForm';
import { ROUTINE_TONE } from './Routines';

interface Action { to: RoutineStatus; label: string; icon: ReactNode; variant?: 'secondary' | 'danger'; confirm?: string }
const ACTIONS: Record<RoutineStatus, Action[]> = {
  borrador: [
    { to: 'activa', label: 'Activar', icon: <Play size={16} aria-hidden="true" /> },
    { to: 'archivada', label: 'Archivar', icon: <Archive size={16} aria-hidden="true" />, variant: 'secondary', confirm: 'La rutina dejará de ser visible. Podés restaurarla como borrador cuando quieras.' },
  ],
  activa: [
    { to: 'finalizada', label: 'Marcar como finalizada', icon: <CheckCheck size={16} aria-hidden="true" />, confirm: 'El alumno seguirá viendo la rutina como finalizada, junto con su historial.' },
    { to: 'archivada', label: 'Archivar', icon: <Archive size={16} aria-hidden="true" />, variant: 'secondary', confirm: 'El alumno dejará de ver esta rutina. Podés restaurarla como borrador cuando quieras.' },
  ],
  finalizada: [
    { to: 'activa', label: 'Reactivar', icon: <RotateCcw size={16} aria-hidden="true" /> },
    { to: 'archivada', label: 'Archivar', icon: <Archive size={16} aria-hidden="true" />, variant: 'secondary', confirm: 'El alumno dejará de ver esta rutina. Podés restaurarla como borrador cuando quieras.' },
  ],
  archivada: [{ to: 'borrador', label: 'Restaurar como borrador', icon: <RotateCcw size={16} aria-hidden="true" /> }],
};

function EditPanel({ routine, studentName, onCancel, onSaved }: { routine: Routine; studentName: string; onCancel: () => void; onSaved: () => void }) {
  const { notify } = useToast();
  const exercises = useAsync(() => exercisesApi.listAll(), []);
  if (exercises.loading && !exercises.data) return <LoadingBlock label="Preparando el armador…" />;
  if (exercises.error != null && !exercises.data) return <ErrorState error={exercises.error} onRetry={exercises.reload} />;
  if (!exercises.data) return null;
  return (
    <RoutineForm
      initial={routine}
      exercises={exercises.data}
      // Solo se muestra el alumno: el servidor no permite cambiarlo en una rutina existente.
      students={[{ id: routine.student, firstName: studentName, lastName: '' }]}
      onCancel={onCancel}
      onSubmit={async (core) => {
        await routinesApi.update(routine._id, core);
        notify('Cambios guardados.');
        onSaved();
      }}
    />
  );
}

export default function RoutineDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { data, error, loading, reload } = useAsync(() => routinesApi.get(id), [id]);
  const student = useAsync<StudentDetail | null>(() => (data ? studentsApi.get(data.student) : Promise.resolve(null)), [data?.student]);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const cancelPending = useCallback(() => setPending(null), []); // estable: el Modal reenfoca si cambia
  const [duplicating, setDuplicating] = useState(false);
  const [toDelete, setToDelete] = useState(false);
  const [blocked, setBlocked] = useState('');
  const closeDelete = useCallback(() => { setToDelete(false); setBlocked(''); }, []);

  async function duplicate() {
    setDuplicating(true);
    try { const copy = await routinesApi.duplicate(id); notify('Rutina duplicada como borrador.'); navigate(`/rutinas/${copy._id}`); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo duplicar.', 'danger'); }
    finally { setDuplicating(false); }
  }
  const [deleting, setDeleting] = useState(false);
  async function confirmDelete() {
    setDeleting(true);
    try { await routinesApi.remove(id); notify('Rutina eliminada.'); navigate('/rutinas', { replace: true }); }
    catch (err) {
      if (err instanceof ApiError && err.code === 'ROUTINE_IN_USE') setBlocked(err.message);
      else notify(err instanceof ApiError ? err.message : 'No se pudo eliminar.', 'danger');
    } finally { setDeleting(false); }
  }

  async function changeStatus(a: Action) {
    setBusy(true);
    try { await routinesApi.setStatus(id, a.to); notify(`Rutina: ${ROUTINE_STATUS_LABEL[a.to].toLowerCase()}.`); reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado.', 'danger'); }
    finally { setBusy(false); setPending(null); }
  }

  if (loading && !data) return <LoadingBlock label="Cargando rutina…" />;
  if (error != null && !data) {
    const missing = error instanceof ApiError && error.status === 404;
    return <ErrorState error={missing ? new ApiError(404, 'NOT_FOUND', 'No encontramos esta rutina.') : error} onRetry={missing ? undefined : reload} />;
  }
  if (!data) return null;

  const studentName = student.data ? `${student.data.firstName} ${student.data.lastName}` : 'Alumno';
  const days = [...data.days].sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek));

  return (
    <>
      <PageHeader
        title={data.name}
        description={studentName}
        back={{ to: '/rutinas', label: 'Volver a rutinas' }}
        actions={!editing && (
          <>
            <Badge tone={ROUTINE_TONE[data.status]}>{ROUTINE_STATUS_LABEL[data.status]}</Badge>
            <Button variant="secondary" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEditing(true)}>Editar</Button>
            <Button variant="secondary" icon={<Copy size={16} aria-hidden="true" />} loading={duplicating} onClick={() => void duplicate()}>Duplicar</Button>
            {ACTIONS[data.status].map((a) => (
              <Button key={a.to} variant={a.variant} icon={a.icon} loading={busy && pending === null} onClick={() => (a.confirm ? setPending(a) : void changeStatus(a))}>{a.label}</Button>
            ))}
            <Button variant="ghost" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setToDelete(true)}>Eliminar</Button>
          </>
        )}
      />

      {editing ? (
        <EditPanel routine={data} studentName={studentName} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); }} />
      ) : (
        <div className={p.stack}>
          <Card title="Resumen">
            <dl className={p.dl}>
              <div><dt>Alumno</dt><dd>{student.data ? <Link to={`/alumnos/${student.data.id}`}>{studentName}</Link> : studentName}</dd></div>
              <div><dt>Objetivo</dt><dd>{data.goal || '—'}</dd></div>
              <div><dt>Dificultad</dt><dd>{DIFFICULTY_LABEL[data.difficulty]}</dd></div>
              <div><dt>Duración estimada</dt><dd>{data.estimatedMinutes ? `${data.estimatedMinutes} min` : '—'}</dd></div>
              <div><dt>Inicio</dt><dd>{formatCalendarDate(data.startDate)}</dd></div>
              <div><dt>Fin</dt><dd>{data.endDate ? formatCalendarDate(data.endDate) : 'Sin fecha de fin'}</dd></div>
              <div style={{ gridColumn: '1 / -1' }}><dt>Descripción</dt><dd>{data.description || '—'}</dd></div>
            </dl>
          </Card>

          {days.map((day) => (
            <Card key={day._id} title={DAY_LABEL[day.dayOfWeek]}>
              <ul className={p.list}>
                {day.exercises.map((it) => {
                  const meta = [
                    it.exercise ? MUSCLE_LABEL[it.exercise.muscleGroup] : null,
                    it.weight?.value != null ? `${it.weight.value} ${it.weight.unit}` : null,
                    it.restSeconds ? `descanso ${it.restSeconds} s` : null,
                    it.notes || null,
                  ].filter(Boolean).join(' · ');
                  return (
                    <li key={it._id} className={p.item}>
                      <div className={p.itemMain}>
                        <span className={p.itemTitle}>{it.exercise?.name ?? 'Ejercicio no disponible'}</span>
                        {meta && <span className={p.muted}>{meta}</span>}
                      </div>
                      <span className={p.amount}>{it.sets} × {it.reps}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog open={pending !== null} loading={busy} title={pending ? `${pending.label}?` : ''} confirmLabel={pending?.label ?? ''}
        message={pending?.confirm} onCancel={cancelPending} onConfirm={() => pending && void changeStatus(pending)} />

      <ConfirmDialog open={toDelete} danger loading={deleting} title="¿Eliminar rutina?" confirmLabel="Eliminar definitivamente"
        message={blocked ? blocked : 'Esta acción no se puede deshacer.'} onCancel={closeDelete} onConfirm={() => void confirmDelete()} />
    </>
  );
}
