import { ClipboardCheck } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Badge } from '../components/ui/Badge';
import { LinkButton } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ErrorState, LoadingBlock } from '../components/ui/Feedback';
import { PageHeader } from '../components/ui/PageHeader';
import { useAsync } from '../hooks/useAsync';
import { useRefreshOnFocus } from '../hooks/useRefreshOnFocus';
import { ApiError } from '../services/api';
import { meApi } from '../services/endpoints';
import { DAY_LABEL, DAY_ORDER, DIFFICULTY_LABEL, formatCalendarDate, formatShortDate, MUSCLE_LABEL, nextDateOfWeekday, ROUTINE_STATUS_LABEL } from '../utils/format';
import p from './pages.module.css';
import { ROUTINE_TONE } from './Routines';

export default function MyRoutineDetail() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useAsync(() => meApi.routine(id), [id]);
  useRefreshOnFocus(reload);

  if (loading && !data) return <LoadingBlock label="Cargando rutina…" />;
  if (error != null && !data) {
    const missing = error instanceof ApiError && error.status === 404;
    return <ErrorState error={missing ? new ApiError(404, 'NOT_FOUND', 'No encontramos esta rutina.') : error} onRetry={missing ? undefined : reload} />;
  }
  if (!data) return null;

  const active = data.status === 'activa';
  const today = new Date().getDay();
  const days = [...data.days].sort((a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek));

  return (
    <>
      <PageHeader title={data.name} description={data.goal || undefined} back={{ to: '/mi-rutina', label: 'Volver a mi rutina' }}
        actions={<Badge tone={ROUTINE_TONE[data.status]}>{ROUTINE_STATUS_LABEL[data.status]}</Badge>} />

      <div className={p.stack}>
        <Card title="Resumen">
          <dl className={p.dl}>
            <div><dt>Dificultad</dt><dd>{DIFFICULTY_LABEL[data.difficulty]}</dd></div>
            <div><dt>Duración estimada</dt><dd>{data.estimatedMinutes ? `${data.estimatedMinutes} min` : '—'}</dd></div>
            <div><dt>Inicio</dt><dd>{formatCalendarDate(data.startDate)}</dd></div>
            <div><dt>Fin</dt><dd>{data.endDate ? formatCalendarDate(data.endDate) : 'Sin fecha de fin'}</dd></div>
            {data.description && <div style={{ gridColumn: '1 / -1' }}><dt>Indicaciones de tu entrenador</dt><dd style={{ whiteSpace: 'pre-line' }}>{data.description}</dd></div>}
          </dl>
        </Card>

        {days.map((day) => (
          <Card key={day._id} title={active ? `${DAY_LABEL[day.dayOfWeek]} ${formatShortDate(nextDateOfWeekday(day.dayOfWeek))}` : DAY_LABEL[day.dayOfWeek]}
            actions={(
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                {active && day.dayOfWeek === today && <Badge tone="info">Hoy</Badge>}
                {active && <LinkButton to={`/mi-rutina/${data._id}/registrar/${day._id}`} size="sm" icon={<ClipboardCheck size={16} aria-hidden="true" />}>Registrar entrenamiento</LinkButton>}
              </div>
            )}>
            <ul className={p.list}>
              {day.exercises.map((it) => {
                const ex = it.exercise;
                const meta = [
                  ex ? MUSCLE_LABEL[ex.muscleGroup] : null,
                  it.weight?.value != null ? `${it.weight.value} ${it.weight.unit}` : null,
                  it.restSeconds ? `descanso ${it.restSeconds} s` : null,
                ].filter(Boolean).join(' · ');
                const hasMore = Boolean(ex && (ex.instructions || ex.commonMistakes || ex.media));
                return (
                  <li key={it._id} className={p.exItem}>
                    <div className={p.exTop}>
                      <div className={p.itemMain}>
                        <span className={p.itemTitle}>{ex?.name ?? 'Ejercicio no disponible'}</span>
                        {meta && <span className={p.muted}>{meta}</span>}
                      </div>
                      <span className={p.amount}>{it.sets} × {it.reps}</span>
                    </div>
                    {it.notes && <p className={p.muted} style={{ margin: 'var(--space-1) 0 0' }}>Nota: {it.notes}</p>}
                    {hasMore && ex && (
                      <details className={p.exDetails}>
                        <summary>Cómo se hace</summary>
                        {ex.instructions && <p><strong>Pasos:</strong> {ex.instructions}</p>}
                        {ex.commonMistakes && <p><strong>Errores comunes:</strong> {ex.commonMistakes}</p>}
                        {ex.media && <p><a href={ex.media.url} target="_blank" rel="noopener noreferrer">Ver {ex.media.kind === 'video' ? 'el video' : 'la imagen'}</a></p>}
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
