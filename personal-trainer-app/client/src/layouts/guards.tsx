import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { APP_MODE } from '../appMode';
import { LoadingBlock } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import WrongApp from '../pages/WrongApp';
import type { Role } from '../types/api';

// La protección real está en el backend; esto solo decide qué pantalla mostrar.
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><LoadingBlock label="Verificando sesión…" /></div>;
  if (status === 'anonymous') return <Navigate to="/ingresar" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

export function RoleGate({ role }: { role: Role }) {
  const { user } = useAuth();
  return user?.role === role ? <Outlet /> : <Navigate to="/" replace />;
}

// En el sitio del entrenador solo entran entrenadores; en la app de alumnos, solo alumnos. En modo 'all' no restringe.
export function ModeGate() {
  const { user } = useAuth();
  if (APP_MODE === 'all' || !user) return <Outlet />;
  return user.role === (APP_MODE === 'trainer' ? 'trainer' : 'student') ? <Outlet /> : <WrongApp />;
}
