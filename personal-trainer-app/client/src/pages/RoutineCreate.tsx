import { useNavigate, useSearchParams } from 'react-router-dom';
import { LinkButton } from '../components/ui/Button';
import { Alert, ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../context/ToastContext';
import { useAsync } from '../hooks/useAsync';
import { exercisesApi, routinesApi, studentsApi } from '../services/endpoints';
import { RoutineForm } from './RoutineForm';

export default function RoutineCreate() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const exercises = useAsync(() => exercisesApi.list({ limit: 100 }), []);
  const students = useAsync(() => studentsApi.list({ limit: 100, sort: 'name' }), []);

  const header = <PageHeader title="Nueva rutina" description="Elegí el alumno, definí los días y cargá los ejercicios." back={{ to: '/rutinas', label: 'Volver a rutinas' }} />;

  if ((exercises.loading && !exercises.data) || (students.loading && !students.data)) return <>{header}<LoadingBlock label="Preparando el armador…" /></>;
  if (exercises.error != null && !exercises.data) return <>{header}<ErrorState error={exercises.error} onRetry={exercises.reload} /></>;
  if (students.error != null && !students.data) return <>{header}<ErrorState error={students.error} onRetry={students.reload} /></>;
  if (!exercises.data || !students.data) return null;

  const activeStudents = students.data.items.filter((s) => s.status !== 'inactive');

  if (exercises.data.items.length === 0) {
    return (
      <>
        {header}
        <Alert tone="info">
          Para armar una rutina primero necesitás cargar ejercicios en tu catálogo.
          <div style={{ marginTop: 'var(--space-3)' }}><LinkButton to="/ejercicios" size="sm">Ir a ejercicios</LinkButton></div>
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
      {(exercises.data.total > 100 || students.data.total > 100) && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <Alert tone="warning">Los selectores muestran los primeros 100 ejercicios y alumnos. Si no encontrás uno, archivá los que ya no uses.</Alert>
        </div>
      )}
      <RoutineForm
        exercises={exercises.data.items}
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
