import { useMemo, useState } from 'react';
import { Button } from '../components/ui/Button';
import { SelectField, TextField } from '../components/ui/Field';
import type { Exercise, MuscleGroup } from '../types/api';
import { DIFFICULTY_EX_LABEL, MUSCLE_LABEL } from '../utils/format';
import p from './pages.module.css';

const GROUPS = Object.entries(MUSCLE_LABEL) as [MuscleGroup, string][];
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

interface Props { exercises: Exercise[]; alreadyIds: Set<string>; onAdd: (ids: string[]) => void; onClose: () => void }

/** Lista del catálogo para tildar varios ejercicios de una vez, con búsqueda y filtro por grupo muscular. */
export function ExercisePicker({ exercises, alreadyIds, onAdd, onClose }: Props) {
  const [q, setQ] = useState('');
  const [group, setGroup] = useState('');
  const [picked, setPicked] = useState<string[]>([]); // en el orden en que se fueron eligiendo

  const sections = useMemo(() => {
    const needle = norm(q.trim());
    const visible = exercises.filter((e) => (!group || e.muscleGroup === group) && (!needle || norm(e.name).includes(needle)));
    return GROUPS
      .map(([g, label]) => ({ g, label, items: visible.filter((e) => e.muscleGroup === g).sort((a, b) => a.name.localeCompare(b.name, 'es')) }))
      .filter((s) => s.items.length > 0);
  }, [exercises, q, group]);

  const toggle = (id: string) => setPicked((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <div className={p.formStack}>
      <div className={p.formGrid}>
        <TextField label="Buscar" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ej.: sentadilla" autoComplete="off" />
        <SelectField label="Grupo muscular" value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Todos</option>
          {GROUPS.map(([g, label]) => <option key={g} value={g}>{label}</option>)}
        </SelectField>
      </div>

      <div className={p.pickList} role="group" aria-label="Ejercicios disponibles">
        {sections.length === 0 && <p className={p.empty}>Ningún ejercicio coincide con la búsqueda.</p>}
        {sections.map((s) => (
          <div key={s.g}>
            <h3 className={p.pickHead}>{s.label}</h3>
            {s.items.map((e) => {
              const already = alreadyIds.has(e._id);
              return (
                <label key={e._id} className={`${p.pickRow} ${already ? p.pickDisabled : ''}`}>
                  <input type="checkbox" checked={already || picked.includes(e._id)} disabled={already} onChange={() => toggle(e._id)} />
                  <span className={p.pickName}>{e.name}</span>
                  <span className={p.muted}>{already ? 'ya agregado' : [e.equipment, e.difficulty ? DIFFICULTY_EX_LABEL[e.difficulty] : null].filter(Boolean).join(' · ')}</span>
                </label>
              );
            })}
          </div>
        ))}
      </div>

      <div className={p.formActions}>
        <Button disabled={picked.length === 0} onClick={() => onAdd(picked)}>
          {picked.length === 0 ? 'Agregar' : `Agregar ${picked.length} ${picked.length === 1 ? 'ejercicio' : 'ejercicios'}`}
        </Button>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
      </div>
    </div>
  );
}
