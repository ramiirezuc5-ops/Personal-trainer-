import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoadingBlock } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
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
