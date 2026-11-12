import { LogOut } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../layouts/AuthShell';
import { APP_MODE, OTHER_APP_URL } from '../appMode';

/** Se muestra cuando alguien entra a un sitio que no es el de su rol (p. ej. un alumno en el panel del entrenador). */
export default function WrongApp() {
  const { logout } = useAuth();
  const inTrainerSite = APP_MODE === 'trainer';
  const other = OTHER_APP_URL;
  return (
    <AuthShell
      title={inTrainerSite ? 'Esta es la página del entrenador' : 'Esta es la app de los alumnos'}
      subtitle={inTrainerSite ? 'Tu cuenta es de alumno. Ingresá desde la app de los alumnos.' : 'Tu cuenta es de entrenador. Ingresá desde el panel del entrenador.'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {other && <Button onClick={() => window.location.assign(other)}>{inTrainerSite ? 'Ir a la app de los alumnos' : 'Ir al panel del entrenador'}</Button>}
        <Button variant="secondary" icon={<LogOut size={16} aria-hidden="true" />} onClick={() => void logout()}>Cerrar sesión</Button>
      </div>
    </AuthShell>
  );
}
