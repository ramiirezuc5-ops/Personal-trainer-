import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Feedback';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { ApiError, fieldErrors } from '../services/api';
import type { Difficulty, Exercise, MuscleGroup, RoutineCore, RoutineDayInput, RoutineDetail, Student, WeightUnit } from '../types/api';
import { DAY_LABEL, DAY_ORDER, DIFFICULTY_LABEL, MUSCLE_LABEL, todayISO } from '../utils/format';
import p from './pages.module.css';

interface ItemState { key: string; exercise: string; sets: string; reps: string; weight: string; unit: WeightUnit; rest: string; notes: string }
interface DayState { key: string; dayOfWeek: string; label: string; items: ItemState[] }

let uid = 0;
const nextKey = () => `k${++uid}`;
const newItem = (): ItemState => ({ key: nextKey(), exercise: '', sets: '3', reps: '10', weight: '', unit: 'kg', rest: '60', notes: '' });
const newDay = (dow: number): DayState => ({ key: nextKey(), dayOfWeek: String(dow), label: '', items: [newItem()] });

function fromRoutine(r: RoutineDetail): DayState[] {
  return [...r.days]
    .sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek))
    .map((d) => ({
      key: nextKey(), dayOfWeek: String(d.dayOfWeek), label: d.label ?? '',
      items: d.exercises.map((it) => ({
        key: nextKey(), exercise: it.exercise?._id ?? '', sets: String(it.sets), reps: it.reps,
        weight: it.weight?.value != null ? String(it.weight.value) : '', unit: it.weight?.unit ?? 'kg',
        rest: it.restSeconds != null ? String(it.restSeconds) : '', notes: it.notes ?? '',
      })),
    }));
}

const isInt = (s: string) => /^\d+$/.test(s.trim());

export interface RoutineSubmitMeta { student: string; status: 'borrador' | 'activa' }
interface Props {
  initial?: RoutineDetail;
  defaultStudent?: string;
  exercises: Exercise[];
  students: Pick<Student, 'id' | 'firstName' | 'lastName'>[];
  onSubmit: (core: RoutineCore, meta: RoutineSubmitMeta) => Promise<void>;
  onCancel?: () => void;
}

export function RoutineForm({ initial, defaultStudent, exercises, students, onSubmit, onCancel }: Props) {
  const editing = Boolean(initial);
  const [v, setV] = useState({
    student: initial?.student ?? defaultStudent ?? '', name: initial?.name ?? '', description: initial?.description ?? '', goal: initial?.goal ?? '',
    difficulty: (initial?.difficulty ?? 'media') as Difficulty, minutes: initial?.estimatedMinutes != null ? String(initial.estimatedMinutes) : '',
    startDate: initial?.startDate?.slice(0, 10) ?? todayISO(), endDate: initial?.endDate?.slice(0, 10) ?? '',
  });
  const [days, setDays] = useState<DayState[]>(() => (initial ? fromRoutine(initial) : [newDay(1)]));
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState<'borrador' | 'activa' | 'edit' | null>(null);
  const problemsRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (problems.length) problemsRef.current?.focus(); }, [problems]);

  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));
  const updateDay = (i: number, patch: Partial<DayState>) => setDays((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const updateItem = (di: number, ii: number, patch: Partial<ItemState>) => setDays((ds) => ds.map((d, idx) => (idx === di ? { ...d, items: d.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : d)));
  const addItem = (di: number) => setDays((ds) => ds.map((d, idx) => (idx === di ? { ...d, items: [...d.items, newItem()] } : d)));
  const removeItem = (di: number, ii: number) => setDays((ds) => ds.map((d, idx) => (idx === di ? { ...d, items: d.items.filter((_, j) => j !== ii) } : d)));
  const moveItem = (di: number, ii: number, dir: -1 | 1) => setDays((ds) => ds.map((d, idx) => {
    if (idx !== di) return d;
    const to = ii + dir;
    if (to < 0 || to >= d.items.length) return d;
    const items = [...d.items];
    [items[ii], items[to]] = [items[to], items[ii]];
    return { ...d, items };
  }));
  const addDay = () => {
    const used = new Set(days.map((d) => Number(d.dayOfWeek)));
    const free = DAY_ORDER.find((n) => !used.has(n));
    if (free !== undefined) setDays((ds) => [...ds, newDay(free)]);
  };

  // Ejercicios activos + los que ya usa la rutina que se edita (aunque estén archivados).
  const exerciseOptions = useMemo(() => {
    const list = [...exercises];
    if (initial) {
      const known = new Set(list.map((e) => e._id));
      initial.days.forEach((d) => d.exercises.forEach((it) => {
        if (it.exercise && !known.has(it.exercise._id)) { known.add(it.exercise._id); list.push({ ...it.exercise, description: '', archived: true, createdAt: '' }); }
      }));
    }
    return list;
  }, [exercises, initial]);
  const grouped = useMemo(() => (Object.keys(MUSCLE_LABEL) as MuscleGroup[])
    .map((g) => ({ group: g, items: exerciseOptions.filter((e) => e.muscleGroup === g).sort((a, b) => a.name.localeCompare(b.name, 'es')) }))
    .filter((g) => g.items.length), [exerciseOptions]);

  const studentOptions = useMemo(() => {
    const list = students.map((s) => ({ id: s.id, label: [s.lastName, s.firstName].filter(Boolean).join(', ') }));
    if (initial && !list.some((s) => s.id === initial.student)) list.push({ id: initial.student, label: 'Alumno de esta rutina' });
    return list;
  }, [students, initial]);

  function validate(): string[] {
    const out: string[] = [];
    if (!editing && !v.student) out.push('Elegí el alumno.');
    if (v.name.trim().length < 2) out.push('Escribí el nombre de la rutina (mínimo 2 letras).');
    if (!v.startDate) out.push('Indicá la fecha de inicio.');
    if (v.endDate && v.startDate && v.endDate < v.startDate) out.push('La fecha de fin no puede ser anterior al inicio.');
    if (v.minutes.trim() && (!isInt(v.minutes) || Number(v.minutes) < 5 || Number(v.minutes) > 300)) out.push('La duración estimada debe ser entre 5 y 300 minutos.');
    if (days.length === 0) out.push('Agregá al menos un día de entrenamiento.');
    if (new Set(days.map((d) => d.dayOfWeek)).size !== days.length) out.push('No repitas el mismo día de la semana.');
    days.forEach((d, i) => {
      const name = `${DAY_LABEL[Number(d.dayOfWeek)]} (día ${i + 1})`;
      if (d.items.length === 0) out.push(`${name}: agregá al menos un ejercicio.`);
      d.items.forEach((it, j) => {
        const at = `${name}, ejercicio ${j + 1}`;
        if (!it.exercise) out.push(`${at}: elegí el ejercicio.`);
        if (!isInt(it.sets) || Number(it.sets) < 1 || Number(it.sets) > 20) out.push(`${at}: las series deben ser un número entre 1 y 20.`);
        if (!it.reps.trim()) out.push(`${at}: indicá las repeticiones (ej.: 10, 8-12 o 30s).`);
        else if (it.reps.trim().length > 20) out.push(`${at}: las repeticiones son demasiado largas (máximo 20 caracteres).`);
        if (it.weight.trim() && (Number.isNaN(Number(it.weight)) || Number(it.weight) < 0 || Number(it.weight) > 1000)) out.push(`${at}: el peso debe ser un número entre 0 y 1000.`);
        if (it.rest.trim() && (!isInt(it.rest) || Number(it.rest) > 900)) out.push(`${at}: el descanso debe ser entre 0 y 900 segundos.`);
      });
    });
    return out;
  }

  async function submit(e: { preventDefault: () => void }, mode: 'borrador' | 'activa' | 'edit') {
    e.preventDefault();
    const found = validate();
    setProblems(found);
    if (found.length) return;

    const payloadDays: RoutineDayInput[] = [...days]
      .sort((a, b) => DAY_ORDER.indexOf(Number(a.dayOfWeek)) - DAY_ORDER.indexOf(Number(b.dayOfWeek)))
      .map((d) => ({
        dayOfWeek: Number(d.dayOfWeek), ...(d.label.trim() ? { label: d.label.trim() } : {}),
        exercises: d.items.map((it) => ({
          exercise: it.exercise, sets: Number(it.sets), reps: it.reps.trim(),
          ...(it.weight.trim() ? { weight: { value: Number(it.weight), unit: it.unit } } : {}),
          ...(it.rest.trim() ? { restSeconds: Number(it.rest) } : {}),
          ...(it.notes.trim() ? { notes: it.notes.trim() } : {}),
        })),
      }));

    const core: RoutineCore = {
      name: v.name.trim(), description: v.description.trim(), goal: v.goal.trim(), difficulty: v.difficulty,
      ...(v.minutes.trim() ? { estimatedMinutes: Number(v.minutes) } : {}),
      startDate: v.startDate,
      // Al editar, vaciar la fecha de fin la quita; al crear, simplemente no se envía.
      ...(v.endDate ? { endDate: v.endDate } : editing ? { endDate: null } : {}),
      days: payloadDays,
    };

    setSaving(mode);
    try { await onSubmit(core, { student: v.student, status: mode === 'activa' ? 'activa' : 'borrador' }); }
    catch (err) {
      const fe = Object.values(fieldErrors(err));
      setProblems(fe.length ? fe : [err instanceof ApiError ? err.message : 'No pudimos guardar la rutina.']);
    } finally { setSaving(null); }
  }

  return (
    <form onSubmit={(e) => void submit(e, editing ? 'edit' : 'borrador')} noValidate>
      {problems.length > 0 && (
        <div ref={problemsRef} tabIndex={-1} style={{ marginBottom: 'var(--space-4)', outline: 'none' }}>
          <Alert tone="danger">
            {problems.length === 1 ? problems[0] : <>Revisá estos puntos:<ul className={p.problems}>{problems.map((m, i) => <li key={i}>{m}</li>)}</ul></>}
          </Alert>
        </div>
      )}

      <Card title="Datos generales">
        <div className={p.formGrid}>
          <SelectField label="Alumno" value={v.student} onChange={set('student')} disabled={editing} required hint={editing ? 'No se puede cambiar el alumno de una rutina existente.' : undefined}>
            <option value="">Elegí un alumno</option>
            {studentOptions.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </SelectField>
          <TextField label="Nombre de la rutina" value={v.name} onChange={set('name')} autoComplete="off" required placeholder="Ej.: Fuerza 3 días" />
          <div className={p.span2}><TextField label="Objetivo" value={v.goal} onChange={set('goal')} maxLength={200} /></div>
          <div className={p.span2}><TextAreaField label="Descripción" value={v.description} onChange={set('description')} maxLength={600} hint="Indicaciones generales para el alumno." /></div>
          <TextField label="Inicio" type="date" value={v.startDate} onChange={set('startDate')} required />
          <TextField label="Fin (opcional)" type="date" value={v.endDate} onChange={set('endDate')} />
          <SelectField label="Dificultad" value={v.difficulty} onChange={set('difficulty')}>
            {Object.entries(DIFFICULTY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </SelectField>
          <TextField label="Duración estimada (minutos)" type="number" inputMode="numeric" min={5} max={300} value={v.minutes} onChange={set('minutes')} />
        </div>
      </Card>

      <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {days.map((day, di) => (
          <Card key={day.key} title={`Día ${di + 1}`} actions={days.length > 1 ? <Button size="sm" variant="ghost" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => setDays((ds) => ds.filter((_, i) => i !== di))} aria-label={`Quitar el día ${di + 1}`}>Quitar día</Button> : undefined}>
            <div className={p.dayHead}>
              <SelectField label="Día de la semana" value={day.dayOfWeek} onChange={(e) => updateDay(di, { dayOfWeek: e.target.value })}>
                {DAY_ORDER.map((n) => <option key={n} value={n}>{DAY_LABEL[n]}</option>)}
              </SelectField>
              <TextField label="Nombre del día (opcional)" value={day.label} onChange={(e) => updateDay(di, { label: e.target.value })} maxLength={60} placeholder="Ej.: Tren inferior" />
            </div>

            {day.items.map((it, ii) => (
              <div key={it.key} className={p.itemBox}>
                <div className={p.itemGrid}>
                  <div className={p.c2}>
                    <SelectField label="Ejercicio" value={it.exercise} onChange={(e) => updateItem(di, ii, { exercise: e.target.value })} required>
                      <option value="">Elegí un ejercicio</option>
                      {grouped.map((g) => (
                        <optgroup key={g.group} label={MUSCLE_LABEL[g.group]}>
                          {g.items.map((e) => <option key={e._id} value={e._id}>{e.name}{e.archived ? ' (archivado)' : ''}</option>)}
                        </optgroup>
                      ))}
                    </SelectField>
                  </div>
                  <TextField label="Series" type="number" inputMode="numeric" min={1} max={20} value={it.sets} onChange={(e) => updateItem(di, ii, { sets: e.target.value })} required />
                  <TextField label="Repeticiones" value={it.reps} onChange={(e) => updateItem(di, ii, { reps: e.target.value })} maxLength={20} placeholder="10 · 8-12 · 30s" required />
                  <TextField label="Peso" type="number" inputMode="decimal" min={0} max={1000} step="any" value={it.weight} onChange={(e) => updateItem(di, ii, { weight: e.target.value })} />
                  <SelectField label="Unidad" value={it.unit} onChange={(e) => updateItem(di, ii, { unit: e.target.value as WeightUnit })}>
                    <option value="kg">kg</option><option value="lb">lb</option>
                  </SelectField>
                  <div className={p.c2}><TextField label="Descanso (segundos)" type="number" inputMode="numeric" min={0} max={900} value={it.rest} onChange={(e) => updateItem(di, ii, { rest: e.target.value })} /></div>
                  <div className={p.c4}><TextField label="Notas (opcional)" value={it.notes} onChange={(e) => updateItem(di, ii, { notes: e.target.value })} maxLength={300} /></div>
                </div>
                <div className={p.itemTools}>
                  <Button size="sm" variant="ghost" aria-label={`Subir el ejercicio ${ii + 1}`} disabled={ii === 0} onClick={() => moveItem(di, ii, -1)}><ArrowUp size={16} aria-hidden="true" /></Button>
                  <Button size="sm" variant="ghost" aria-label={`Bajar el ejercicio ${ii + 1}`} disabled={ii === day.items.length - 1} onClick={() => moveItem(di, ii, 1)}><ArrowDown size={16} aria-hidden="true" /></Button>
                  <Button size="sm" variant="ghost" aria-label={`Quitar el ejercicio ${ii + 1}`} onClick={() => removeItem(di, ii)}><Trash2 size={16} aria-hidden="true" /></Button>
                </div>
              </div>
            ))}

            <div className={p.dayActions}>
              <Button size="sm" variant="secondary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => addItem(di)}>Agregar ejercicio</Button>
            </div>
          </Card>
        ))}
        <div>
          <Button variant="secondary" icon={<Plus size={18} aria-hidden="true" />} onClick={addDay} disabled={days.length >= 7}>Agregar día</Button>
        </div>
      </div>

      <div className={p.formActions}>
        {editing ? (
          <>
            <Button type="submit" loading={saving === 'edit'}>Guardar cambios</Button>
            {onCancel && <Button variant="ghost" onClick={onCancel} disabled={saving !== null}>Cancelar</Button>}
          </>
        ) : (
          <>
            <Button variant="secondary" loading={saving === 'borrador'} disabled={saving !== null} onClick={(e) => void submit(e, 'borrador')}>Guardar como borrador</Button>
            <Button loading={saving === 'activa'} disabled={saving !== null} onClick={(e) => void submit(e, 'activa')}>Guardar y activar</Button>
            {onCancel && <Button variant="ghost" onClick={onCancel} disabled={saving !== null}>Cancelar</Button>}
          </>
        )}
      </div>
      {!editing && <p style={{ marginTop: 'var(--space-3)', color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>Al activar, el alumno recibe un aviso de rutina nueva. Un borrador solo lo ves vos.</p>}
    </form>
  );
}
