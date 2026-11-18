import { useState, type FormEvent } from 'react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { TextField } from '../components/ui/Field';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError, fieldErrors } from '../services/api';
import { meApi } from '../services/endpoints';
import type { Student } from '../types/api';
import { formatDate, LEVEL_LABEL } from '../utils/format';
import p from './pages.module.css';

type Editable = 'phone' | 'birthDate' | 'goal';
const LABELS: Record<Editable, string> = { phone: 'Teléfono', birthDate: 'Fecha de nacimiento', goal: 'Objetivo' };

function ProfileForm({ me, onSaved }: { me: Student; onSaved: () => void }) {
  const { notify } = useToast();
  const fields = (['phone', 'birthDate', 'goal'] as Editable[]).filter((f) => me.studentEditableFields.includes(f));
  const [v, setV] = useState<Record<Editable, string>>({ phone: me.phone, birthDate: me.birthDate?.slice(0, 10) ?? '', goal: me.goal });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const patch: Partial<Record<Editable, string>> = {};
    fields.forEach((f) => { if (f !== 'birthDate' || v.birthDate) patch[f] = v[f]; });
    setLoading(true);
    try { await meApi.updateProfile(patch); notify('Datos actualizados.'); onSaved(); }
    catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors(fe); else notify(err instanceof ApiError ? err.message : 'No se pudo guardar.', 'danger');
    } finally { setLoading(false); }
  }

  if (!fields.length) return <p className={p.empty}>Tu entrenador no habilitó la edición de datos. Si algo cambió, avisale.</p>;
  return (
    <form onSubmit={(e) => void submit(e)} noValidate>
      <div className={p.formGrid}>
        {fields.map((f) => <TextField key={f} label={LABELS[f]} type={f === 'birthDate' ? 'date' : f === 'phone' ? 'tel' : 'text'} value={v[f]} onChange={(e) => setV((s) => ({ ...s, [f]: e.target.value }))} error={errors[f]} />)}
      </div>
      <div className={p.formActions}><Button type="submit" loading={loading}>Guardar cambios</Button></div>
    </form>
  );
}

export default function StudentHome() {
  const { data, error, loading, reload } = useAsync(() => meApi.profile(), []);
  if (loading && !data) return <LoadingBlock label="Cargando tu perfil…" />;
  if (error != null && !data) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return null;
  return (
    <>
      <PageHeader title={`Hola, ${data.firstName}`} description="Tu perfil de entrenamiento." />
      <div className={p.stack}>
        <Alert tone="info">Tus turnos y tu progreso estarán disponibles en las próximas versiones de la aplicación.</Alert>
        <Card title="Mis datos">
          <dl className={p.dl}>
            <div><dt>Nombre</dt><dd>{data.firstName} {data.lastName}</dd></div>
            <div><dt>Correo</dt><dd>{data.email}</dd></div>
            <div><dt>Nivel</dt><dd>{LEVEL_LABEL[data.experienceLevel]}</dd></div>
            <div><dt>Objetivo</dt><dd>{data.goal || '—'}</dd></div>
            <div><dt>Fecha de ingreso</dt><dd>{formatDate(data.joinedAt)}</dd></div>
          </dl>
        </Card>
        <Card title="Datos que podés editar"><ProfileForm me={data} onSaved={reload} /></Card>
      </div>
    </>
  );
}
