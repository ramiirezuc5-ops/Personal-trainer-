import { Calendar, ClipboardList, MailPlus, Pencil, UserCheck, UserX } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { Button, LinkButton } from '../components/ui/Button';
import { Card, StatCard } from '../components/ui/Card';
import { ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError } from '../services/api';
import { studentsApi } from '../services/endpoints';
import { formatCalendarDate, formatDate, formatDateTime, LEVEL_LABEL, STATUS_LABEL } from '../utils/format';
import p from './pages.module.css';
import { StudentBilling } from './StudentBilling';
import { StudentForm } from './StudentForm';
import { STATUS_TONE } from './Students';

const FIELD_LABEL: Record<string, string> = { phone: 'Teléfono', birthDate: 'Fecha de nacimiento', availability: 'Disponibilidad', goal: 'Objetivo' };

export default function StudentDetail() {
  const { id = '' } = useParams();
  const { notify } = useToast();
  const { data, error, loading, reload } = useAsync(() => studentsApi.get(id), [id]);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, okMessage: string) {
    setBusy(true);
    try { await action(); notify(okMessage); reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No se pudo completar la acción.', 'danger'); }
    finally { setBusy(false); setConfirm(false); }
  }

  if (loading && !data) return <LoadingBlock label="Cargando ficha…" />;
  if (error != null && !data) {
    const notFound = error instanceof ApiError && error.status === 404;
    return <ErrorState error={notFound ? new ApiError(404, 'NOT_FOUND', 'No encontramos a este alumno.') : error} onRetry={notFound ? undefined : reload} />;
  }
  if (!data) return null;
  const st = data.summary;

  return (
    <>
      <PageHeader
        title={`${data.firstName} ${data.lastName}`}
        description={data.email}
        back={{ to: '/alumnos', label: 'Volver a alumnos' }}
        actions={!editing && (
          <>
            <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
            <Button variant="secondary" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEditing(true)}>Editar</Button>
            <LinkButton to={`/rutinas/nueva?alumno=${data.id}`} variant="secondary" icon={<ClipboardList size={16} aria-hidden="true" />}>Nueva rutina</LinkButton>
            <LinkButton to={`/agenda?alumno=${data.id}`} variant="secondary" icon={<Calendar size={16} aria-hidden="true" />}>Ver agenda</LinkButton>
            {data.status === 'pending' && <Button variant="secondary" icon={<MailPlus size={16} aria-hidden="true" />} loading={busy} onClick={() => void run(() => studentsApi.resendInvite(data.id), 'Invitación reenviada.')}>Reenviar invitación</Button>}
            {data.status === 'inactive'
              ? <Button icon={<UserCheck size={16} aria-hidden="true" />} loading={busy} onClick={() => void run(() => studentsApi.reactivate(data.id), 'Alumno reactivado.')}>Reactivar</Button>
              : <Button variant="danger" icon={<UserX size={16} aria-hidden="true" />} onClick={() => setConfirm(true)}>Desactivar</Button>}
          </>
        )}
      />

      <div className={p.stack}>
        <div className={p.statGrid}>
          <StatCard label="Rutinas activas" value={st.activeRoutines} hint={<Link to={`/rutinas?alumno=${data.id}`}>Ver rutinas</Link>} />
          <StatCard label="Último entrenamiento" value={st.lastWorkoutAt ? formatDate(st.lastWorkoutAt) : '—'} hint={st.lastWorkoutAt ? undefined : 'Todavía no registró entrenamientos'} />
          <StatCard label="Próximo turno" value={st.nextAppointment ? formatDateTime(st.nextAppointment.start) : '—'} hint={st.nextAppointment?.status} />
          <StatCard label="Membresía" value={st.membership ? `Hasta ${formatDate(st.membership.endDate)}` : '—'} hint={st.membership ? st.membership.status : 'Sin membresía vigente'} />
        </div>

        <Card title={editing ? 'Editar ficha' : 'Ficha del alumno'}>
          {editing ? (
            <StudentForm initial={data} submitLabel="Guardar cambios" onCancel={() => setEditing(false)}
              onSubmit={async (input) => { await studentsApi.update(data.id, input); notify('Cambios guardados.'); setEditing(false); reload(); }} />
          ) : (
            <dl className={p.dl}>
              <div><dt>Nivel</dt><dd>{LEVEL_LABEL[data.experienceLevel]}</dd></div>
              <div><dt>Objetivo</dt><dd>{data.goal || '—'}</dd></div>
              <div><dt>Teléfono</dt><dd>{data.phone || '—'}</dd></div>
              <div><dt>Fecha de nacimiento</dt><dd>{formatCalendarDate(data.birthDate)}</dd></div>
              <div><dt>Disponibilidad</dt><dd>{data.availability || '—'}</dd></div>
              <div><dt>Alta</dt><dd>{formatDate(data.joinedAt)}</dd></div>
              <div><dt>Puede editar</dt><dd>{data.studentEditableFields.length ? data.studentEditableFields.map((f) => FIELD_LABEL[f] ?? f).join(', ') : 'Nada'}</dd></div>
              <div><dt>Observaciones (privadas)</dt><dd>{data.notes || '—'}</dd></div>
            </dl>
          )}
        </Card>
      </div>

      {!editing && <div style={{ marginTop: 'var(--space-4)' }}><StudentBilling studentId={data.id} studentName={`${data.firstName} ${data.lastName}`} onChanged={reload} /></div>}

      <ConfirmDialog open={confirm} danger loading={busy} title="¿Desactivar alumno?" confirmLabel="Desactivar"
        message={<>{data.firstName} no podrá ingresar a su cuenta. <strong>No se borra nada</strong>: su historial de rutinas, turnos, pagos y mediciones se conserva y podés reactivarlo cuando quieras.</>}
        onCancel={() => setConfirm(false)} onConfirm={() => void run(() => studentsApi.deactivate(data.id), 'Alumno desactivado.')} />
    </>
  );
}
