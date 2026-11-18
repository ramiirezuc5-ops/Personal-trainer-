import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { TextAreaField, TextField } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError, fieldErrors } from '../services/api';
import { meApi } from '../services/endpoints';
import type { RoutineDetail, WeightUnit, WorkoutInput } from '../types/api';
import { DAY_LABEL, todayISO } from '../utils/format';
import p from './pages.module.css';

interface SetRow { key: number; reps: string; weight: string }
interface ExState { exercise: string; name: string; plan: string; completed: boolean; unit: WeightUnit; sets: SetRow[] }

// El servidor acepta entrenamientos de los últimos 14 días; se deja un día de margen.
const MAX_BACK_DAYS = 13;
let rowKey = 0;
const isInt = (s: string) => /^\d+$/.test(s.trim());
const makeId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);
const addDaysISO = (iso: string, delta: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + delta); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

type Day = RoutineDetail['days'][number];

function initialExercises(day: Day): ExState[] {
  return day.exercises.flatMap((it) => {
    if (!it.exercise) return [];
    const unit = it.weight?.unit ?? 'kg';
    return [{
      exercise: it.exercise._id, name: it.exercise.name, completed: true, unit,
      plan: `${it.sets} × ${it.reps}${it.weight?.value != null ? ` · ${it.weight.value} ${unit}` : ''}`,
      sets: Array.from({ length: it.sets }, () => ({ key: ++rowKey, reps: isInt(it.reps) ? it.reps.trim() : '', weight: it.weight?.value != null ? String(it.weight.value) : '' })),
    }];
  });
}

function WorkoutForm({ routine, day }: { routine: RoutineDetail; day: Day }) {
  const navigate = useNavigate();
  const { notify } = useToast();
  const today = todayISO();
  const [requestId] = useState(makeId); // el mismo identificador en cada reintento evita registros duplicados
  const [date, setDate] = useState(today);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [exs, setExs] = useState<ExState[]>(() => initialExercises(day));
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const problemsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (problems.length) problemsRef.current?.focus(); }, [problems]);

  const updateEx = (i: number, patch: Partial<ExState>) => setExs((l) => l.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  const updateSet = (i: number, j: number, patch: Partial<SetRow>) => setExs((l) => l.map((e, idx) => (idx === i ? { ...e, sets: e.sets.map((s, k) => (k === j ? { ...s, ...patch } : s)) } : e)));
  const addSet = (i: number) => setExs((l) => l.map((e, idx) => (idx === i && e.sets.length < 20 ? { ...e, sets: [...e.sets, { key: ++rowKey, reps: '', weight: '' }] } : e)));
  const removeSet = (i: number, j: number) => setExs((l) => l.map((e, idx) => (idx === i ? { ...e, sets: e.sets.filter((_, k) => k !== j) } : e)));

  function validate(): string[] {
    const out: string[] = [];
    if (!date || date > today) out.push('La fecha no puede ser futura.');
    else if (date < addDaysISO(today, -MAX_BACK_DAYS)) out.push('Solo podés registrar entrenamientos de los últimos 14 días.');
    if (duration.trim() && (!isInt(duration) || Number(duration) > 600)) out.push('La duración debe ser un número de minutos entre 0 y 600.');
    if (!exs.some((e) => e.completed)) out.push('Marcá al menos un ejercicio como hecho.');
    exs.filter((e) => e.completed).forEach((e) => e.sets.forEach((s, j) => {
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
      // Hoy se envía la hora actual; un día anterior se envía al mediodía, para que la fecha no se corra por la zona horaria.
      performedAt: date === today ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString(),
      ...(duration.trim() ? { durationMinutes: Number(duration) } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      exercises: exs.map((e) => (e.completed
        ? { exercise: e.exercise, completed: true, sets: e.sets.filter((s) => s.reps.trim() !== '').map((s) => ({ reps: Number(s.reps), ...(s.weight.trim() ? { weight: Number(s.weight), unit: e.unit } : {}) })) }
        : { exercise: e.exercise, completed: false })),
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

      <div className={p.cardsGap}>
        <Card title="Datos del entrenamiento">
          <div className={p.formGrid}>
            <TextField label="Fecha" type="date" value={date} min={addDaysISO(today, -MAX_BACK_DAYS)} max={today} onChange={(e) => setDate(e.target.value)} required />
            <TextField label="Duración en minutos (opcional)" type="number" inputMode="numeric" min={0} max={600} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
        </Card>

        {exs.map((e, i) => (
          <Card key={`${e.exercise}-${i}`} title={e.name} actions={<span className={p.muted}>Indicado: {e.plan}</span>}>
            <label className={p.exCheck}>
              <input type="checkbox" checked={e.completed} onChange={(ev) => updateEx(i, { completed: ev.target.checked })} />
              Lo hice
            </label>
            {e.completed && (
              <>
                {e.sets.map((s, j) => (
                  <div key={s.key} className={p.setRow}>
                    <span className={p.setNum}>Serie {j + 1}</span>
                    <TextField label="Repeticiones" type="number" inputMode="numeric" min={0} max={1000} value={s.reps} onChange={(ev) => updateSet(i, j, { reps: ev.target.value })} />
                    <TextField label={`Peso (${e.unit})`} type="number" inputMode="decimal" min={0} max={1000} step="any" value={s.weight} onChange={(ev) => updateSet(i, j, { weight: ev.target.value })} />
                    <Button size="sm" variant="ghost" aria-label={`Quitar la serie ${j + 1} de ${e.name}`} onClick={() => removeSet(i, j)}><Trash2 size={16} aria-hidden="true" /></Button>
                  </div>
                ))}
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => addSet(i)} disabled={e.sets.length >= 20}>Agregar serie</Button>
                </div>
              </>
            )}
          </Card>
        ))}

        <Card title="Comentarios">
          <TextAreaField label="Notas (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} hint="Cómo te sentiste, qué te costó, molestias…" />
        </Card>
      </div>

      <div className={p.formActions}>
        <Button type="submit" loading={saving}>Guardar entrenamiento</Button>
        <LinkButton to={`/mi-rutina/${routine._id}`} variant="ghost">Cancelar</LinkButton>
      </div>
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
      <PageHeader title="Registrar entrenamiento" description={`${data.name} · ${DAY_LABEL[day.dayOfWeek]}`} back={back} />
      <WorkoutForm routine={data} day={day} />
    </>
  );
}
