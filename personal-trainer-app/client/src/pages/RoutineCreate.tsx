import { Library } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, LinkButton } from '../components/ui/Button';
import { Alert, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { ApiError } from '../services/api';
import { exercisesApi, routinesApi, studentsApi } from '../services/endpoints';
import { RoutineForm } from './RoutineForm';

export default function RoutineCreate() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const exercises = useAsync(() => exercisesApi.listAll(), []);
  const [importing, setImporting] = useState(false);

  async function importBase() {
    setImporting(true);
    try { const r = await exercisesApi.importBase(); notify(`Se agregaron ${r.created} ejercicios a tu catálogo.`); exercises.reload(); }
    catch (err) { notify(err instanceof ApiError ? err.message : 'No pudimos cargar la biblioteca.', 'danger'); }
    finally { setImporting(false); }
  }
  const students = useAsync(() => studentsApi.list({ limit: 100, sort: 'name' }), []);

  const header = <PageHeader title="Nueva rutina" description="Elegí el alumno, definí los días y cargá los ejercicios." back={{ to: '/rutinas', label: 'Volver a rutinas' }} />;

  if ((exercises.loading && !exercises.data) || (students.loading && !students.data)) return <>{header}<LoadingBlock label="Preparando el armador…" /></>;
  if (exercises.error != null && !exercises.data) return <>{header}<ErrorState error={exercises.error} onRetry={exercises.reload} /></>;
  if (students.error != null && !students.data) return <>{header}<ErrorState error={students.error} onRetry={students.reload} /></>;
  if (!exercises.data || !students.data) return null;

  const activeStudents = students.data.items.filter((s) => s.status !== 'inactive');

  if (exercises.data.length === 0) {
    return (
      <>
        {header}
        <Alert tone="info">
          Para armar una rutina primero necesitás ejercicios en tu catálogo. Cargá la biblioteca base (más de 100 ejercicios listos para usar) y después solo elegís los que van en cada día.
          <div style={{ marginTop: 'var(--space-3)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button size="sm" icon={<Library size={16} aria-hidden="true" />} loading={importing} onClick={() => void importBase()}>Cargar ejercicios base</Button>
            <LinkButton to="/ejercicios" size="sm" variant="secondary">Crear los míos</LinkButton>
          </div>
        </Alert>
      </>
    );
  }
  if (activeStudents.length === 0) {
    return (
      <>
        {header}
        <Alert tone="info">
          Todavía no tenés alumnos activos o pendientes a quienes asignarles una rutina.
          <div style={{ marginTop: 'var(--space-3)' }}><LinkButton to="/alumnos/nuevo" size="sm">Registrar alumno</LinkButton></div>
        </Alert>
      </>
    );
  }

  return (
    <>
      {header}
      {students.data.total > 100 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert tone="warning">La lista muestra los primeros 100 alumnos. Si no encontrás a uno, archivá los que ya no entrenan.</Alert>
        </div>
      )}
      <RoutineForm
        exercises={exercises.data}
        students={activeStudents}
        defaultStudent={params.get('alumno') ?? undefined}
        onCancel={() => navigate('/rutinas')}
        onSubmit={async (core, meta) => {
          const { endDate, ...rest } = core;
          const created = await routinesApi.create({ ...rest, ...(endDate ? { endDate } : {}), student: meta.student, status: meta.status });
          notify(meta.status === 'activa' ? 'Rutina creada y activada. El alumno recibió un aviso.' : 'Rutina guardada como borrador.');
          navigate(`/rutinas/${created._id}`, { replace: true });
        }}
      />
    </>
  );
}
