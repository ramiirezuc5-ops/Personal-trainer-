import { useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import p from './pages.module.css';

/** Pestañas visibles dentro de "Ejercicios y rutinas": las dos pantallas viven bajo un mismo ítem de menú. */
export function ExerciseRoutineTabs() {
  const { pathname } = useLocation();
  const onExercises = pathname.startsWith('/ejercicios');
  return (
    <nav className={p.sectionTabs} aria-label="Secciones de ejercicios y rutinas">
      <Link to="/rutinas" className={`${p.sectionTab} ${!onExercises ? p.sectionTabActive : ''}`} aria-current={!onExercises ? 'page' : undefined}>Rutinas</Link>
      <Link to="/ejercicios" className={`${p.sectionTab} ${onExercises ? p.sectionTabActive : ''}`} aria-current={onExercises ? 'page' : undefined}>Ejercicios</Link>
    </nav>
  );
}
