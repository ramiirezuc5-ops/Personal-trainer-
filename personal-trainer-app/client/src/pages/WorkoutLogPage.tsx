import { Check, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { TextAreaField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError, fieldErrors } from '../services/api';
import { meApi } from '../services/endpoints';
import type { RoutineDetail, WorkoutInput } from '../types/api';
import { DAY_LABEL } from '../utils/format';
import { ExercisePicker } from './ExercisePicker';
import p from './pages.module.css';

interface SetRow { key: number; reps: string; weight: string; done: boolean }
interface ExState { exercise: string; name: string; sets: SetRow[] }
type Previous = Record<string, { performedAt: string; sets: { reps: number; weight?: number }[] } | null>;

let rowKey = 0;
const isInt = (s: string) => /^\d+$/.test(s.trim());
const makeId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
const oneSet = (): SetRow => ({ key: ++rowKey, done: true, reps: '', weight: '' });

type Day = RoutineDetail['days'][number];

// Arranca con una sola serie por ejercicio, vacía: el alumno la completa y agrega las que necesite.
function initialExercises(day: Day): ExState[] {
  return day.exercises.flatMap((it) => (it.exercise ? [{ exercise: it.exercise._id, name: it.exercise.name, sets: [oneSet()] }] : []));
}

function WorkoutForm({ routine, day }: { routine: RoutineDetail; day: Day }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [requestId] = useState(makeId); // el mismo identificador en cada reintento evita registros duplicados
  const [notes, setNotes] = useState('');
  const [exs, setExs] = useState<ExState[]>(() => initialExercises(day));
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const closePicker = useCallback(() => setPicking(false), []);
  const problemsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (problems.length) problemsRef.current?.focus(); }, [problems]);

  const exerciseIds = useMemo(() => exs.map((e) => e.exercise), [exs]);
  const idsKey = exerciseIds.join(',');
  const previous = useAsync<Previous>(() => (exerciseIds.length ? meApi.lastPerformance(exerciseIds) : Promise.resolve({})), [idsKey]);
  const catalog = useAsync(() => meApi.exercises(), []);

  const updateSet = (i: number, j: number, patch: Partial<SetRow>) => setExs((l) => l.map((e, idx) => (idx === i ? { ...e, sets: e.sets.map((s, k) => (k === j ? { ...s, ...patch } : s)) } : e)));
  const addSet = (i: number) => setExs((l) => l.map((e, idx) => (idx === i && e.sets.length < 20 ? { ...e, sets: [...e.sets, oneSet()] } : e)));
  const removeSet = (i: number, j: number) => setExs((l) => l.map((e, idx) => (idx === i ? { ...e, sets: e.sets.filter((_, k) => k !== j) } : e)));
  const removeExercise = (i: number) => setExs((l) => l.filter((_, idx) => idx !== i));
  const addExercises = (ids: string[]) => setExs((l) => [...l, ...ids.flatMap((id) => {
    const ex = catalog.data?.find((c) => c._id === id);
    return ex ? [{ exercise: ex._id, name: ex.name, sets: [oneSet()] }] : [];
  })]);

  const { volume, seriesDone } = useMemo(() => {
    let vol = 0; let count = 0;
    for (const e of exs) for (const s of e.sets) {
      if (!s.done || !s.reps.trim()) continue;
      count += 1;
      const reps = Number(s.reps) || 0; const w = Number(s.weight) || 0;
      if (!Number.isNaN(reps) && !Number.isNaN(w)) vol += reps * w;
    }
    return { volume: vol, seriesDone: count };
  }, [exs]);

  function validate(): string[] {
    const out: string[] = [];
    if (!exs.some((e) => e.sets.some((s) => s.done))) out.push('Marcá al menos una serie como hecha.');
    exs.forEach((e) => e.sets.forEach((s, j) => {
      if (!s.done) return;
      if (s.reps.trim() && (!isInt(s.reps) || Number(s.reps) > 1000)) out.push(`${e.name}, serie ${j + 1}: las repeticiones deben ser un número entero.`);
      if (s.weight.trim() && (Number.isNaN(Number(s.weight)) || Number(s.weight) < 0 || Number(s.weight) > 1000)) out.push(`${e.name}, serie ${j + 1}: el peso debe ser un número entre 0 y 1000.`);
    }));
    return out;
  }

  async function submit() {
    const found = validate();
    setProblems(found);
    if (found.length) return;

    const input: WorkoutInput = {
      routine: routine._id, dayId: day._id, clientRequestId: requestId,
      performedAt: new Date().toISOString(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      exercises: exs.map((e) => {
        const doneSets = e.sets.filter((s) => s.done && s.reps.trim() !== '');
        return doneSets.length
          ? { exercise: e.exercise, completed: true, sets: doneSets.map((s) => ({ reps: Number(s.reps), ...(s.weight.trim() ? { weight: Number(s.weight), unit: 'kg' as const } : {}) })) }
          : { exercise: e.exercise, completed: false };
      }),
    };

    setSaving(true);
    try {
      const res = await meApi.logWorkout(input);
      notify(res.duplicate ? 'Este entrenamiento ya estaba registrado.' : '¡Entrenamiento registrado! Buen trabajo.');
      navigate('/mi-rutina', { replace: true });
    } catch (err) {
      const fe = Object.values(fieldErrors(err));
      setProblems(fe.length ? fe : [err instanceof ApiError ? err.message : 'No pudimos guardar el entrenamiento.']);
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
      {problems.length > 0 && (
        <div ref={problemsRef} tabIndex={-1} style={{ marginBottom: 'var(--space-4)', outline: 'none' }}>
          <Alert tone="danger">
            {problems.length === 1 ? problems[0] : <>Revisá estos puntos:<ul className={p.problems}>{problems.map((m, i) => <li key={i}>{m}</li>)}</ul></>}
          </Alert>
        </div>
      )}

      <div className={p.workoutHead} style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className={p.workoutStat}><span>Volumen</span><span>{volume.toLocaleString('es-AR')} kg</span></div>
        <div className={p.workoutStat}><span>Series</span><span>{seriesDone}</span></div>
      </div>

      <div className={p.cardsGap}>
        {exs.map((e, i) => {
          const prev = previous.data?.[e.exercise];
          return (
            <Card key={`${e.exercise}-${i}`}>
              <div className={p.exerciseCardHead}>
                <span className={p.exerciseCardName}>{e.name}</span>
                <Button size="sm" variant="ghost" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => removeExercise(i)} aria-label={`Quitar ${e.name} de este entrenamiento`}>Quitar</Button>
              </div>

              <table className={p.setTable}>
                <thead>
                  <tr><th>Serie</th><th>Anterior</th><th>Kg</th><th>Reps</th><th></th><th></th></tr>
                </thead>
                <tbody>
                  {e.sets.map((s, j) => {
                    const prevSet = prev?.sets[j];
                    return (
                      <tr key={s.key} className={s.done ? p.setDone : undefined}>
                        <td><span className={p.setNumBadge}>{j + 1}</span></td>
                        <td className={p.setPrevCell}>{prevSet ? `${prevSet.weight ?? '–'}kg × ${prevSet.reps}` : '—'}</td>
                        <td><input className={p.setInput} type="number" inputMode="decimal" min={0} max={1000} step="any" value={s.weight} onChange={(ev) => updateSet(i, j, { weight: ev.target.value })} aria-label={`Peso de la serie ${j + 1} de ${e.name}`} /></td>
                        <td><input className={p.setInput} type="number" inputMode="numeric" min={0} max={1000} value={s.reps} onChange={(ev) => updateSet(i, j, { reps: ev.target.value })} aria-label={`Repeticiones de la serie ${j + 1} de ${e.name}`} /></td>
                        <td>
                          <button type="button" className={p.setCheckBtn} aria-pressed={s.done} aria-label={`Marcar como hecha la serie ${j + 1} de ${e.name}`} onClick={() => updateSet(i, j, { done: !s.done })}>
                            <Check size={16} aria-hidden="true" />
                          </button>
                        </td>
                        <td>
                          <Button size="sm" variant="ghost" aria-label={`Quitar la serie ${j + 1} de ${e.name}`} onClick={() => removeSet(i, j)} disabled={e.sets.length <= 1}><Trash2 size={16} aria-hidden="true" /></Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div style={{ marginTop: 'var(--space-3)' }}>
                <Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => addSet(i)} disabled={e.sets.length >= 20}>Agregar serie</Button>
              </div>
            </Card>
          );
        })}

        <Button variant="secondary" icon={<Plus size={18} aria-hidden="true" />} onClick={() => setPicking(true)} disabled={catalog.loading}>Agregar ejercicio</Button>

        <Card title="Comentarios">
          <TextAreaField label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} hint="Cómo te sentiste, qué te costó, molestias…" />
        </Card>
      </div>

      <div className={p.formActions}>
        <Button type="submit" loading={saving}>Terminar entrenamiento</Button>
        <LinkButton to={`/mi-rutina/${routine._id}`} variant="ghost">Cancelar</LinkButton>
      </div>

      <Modal open={picking} title="Agregar ejercicio" onClose={closePicker}>
        {picking && catalog.data && (
          <ExercisePicker exercises={catalog.data} alreadyIds={new Set(exs.map((e) => e.exercise))} onClose={closePicker} onAdd={(ids) => { addExercises(ids); closePicker(); }} />
        )}
        {picking && !catalog.data && catalog.error != null && <Alert tone="danger">No pudimos cargar tu catálogo de ejercicios.</Alert>}
      </Modal>
    </form>
  );
}

export default function WorkoutLogPage() {
  const { id = '', dayId = '' } = useParams();
  const { data, error, loading, reload } = useAsync(() => meApi.routine(id), [id]);
  const back = { to: `/mi-rutina/${id}`, label: 'Volver a la rutina' };

  if (loading && !data) return <LoadingBlock label="Cargando…" />;
  if (error != null && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;

  const day = data.days.find((d) => d._id === dayId);
  if (!day) return <><PageHeader title="Registrar entrenamiento" back={back} /><Alert tone="danger">No encontramos ese día en la rutina.</Alert></>;
  if (data.status !== 'activa') return <><PageHeader title="Registrar entrenamiento" back={back} /><Alert tone="info">Esta rutina no está activa, por eso no se pueden registrar entrenamientos.</Alert></>;

  return (
    <>
      <PageHeader title="Entreno" description={`${data.name} · ${DAY_LABEL[day.dayOfWeek]}`} back={back} />
      <WorkoutForm routine={data} day={day} />
    </>
  );
}
