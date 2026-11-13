import { Dumbbell, UserRound } from 'lucide-react';
import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { APP_MODE } from '../appMode';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../layouts/AuthShell';
import s from '../layouts/layout.module.css';
import { ApiError } from '../services/api';
import { isEmail } from '../utils/format';

type Portal = 'student' | 'trainer';

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  ACCOUNT_LOCKED: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.',
  ACCOUNT_PENDING: 'Todavía no activaste tu cuenta. Usá el enlace de la invitación que te llegó por correo.',
  ACCOUNT_INACTIVE: 'Tu cuenta está inactiva. Contactá a tu entrenador.',
  RATE_LIMITED: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
};

const TABS: { id: Portal; label: string; icon: ReactNode }[] = [
  { id: 'student', label: 'Alumno', icon: <UserRound size={16} aria-hidden="true" /> },
  { id: 'trainer', label: 'Entrenador', icon: <Dumbbell size={16} aria-hidden="true" /> },
];
const SUBTITLE: Record<Portal, string> = {
  student: 'Accedé a tu rutina, tus entrenamientos y tu mensualidad.',
  trainer: 'Panel del entrenador: gestioná tus alumnos, rutinas y pagos.',
};

const STORAGE_KEY = 'pt_portal';
/** Pestaña inicial: la del enlace (?como=entrenador), si no la última con la que se ingresó, si no «Alumno». */
function initialPortal(param: string | null): Portal {
  if (param === 'entrenador' || param === 'trainer') return 'trainer';
  if (param === 'alumno' || param === 'student') return 'student';
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved === 'trainer' || saved === 'student') return saved; } catch { /* sin almacenamiento */ }
  return 'student';
}

function LoginForm({ portal }: { portal: Portal }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Ingresá tu correo electrónico.';
    else if (!isEmail(email.trim())) next.email = 'Revisá el formato del correo (ej.: nombre@correo.com).';
    if (!password) next.password = 'Ingresá tu contraseña.';
    setErrors(next);
    setServerError('');
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await login(email.trim(), password, portal);
      try { localStorage.setItem(STORAGE_KEY, portal); } catch { /* sin almacenamiento */ }
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? (MESSAGES[err.code] ?? err.message) : 'No pudimos iniciar sesión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={s.form} onSubmit={(e) => void onSubmit(e)} noValidate>
      {serverError && <Alert tone="danger">{serverError}</Alert>}
      <TextField label="Correo electrónico" type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
      <TextField label="Contraseña" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} required />
      <Button type="submit" loading={loading}>Ingresar</Button>
    </form>
  );
}

export default function Login() {
  const { status } = useAuth();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [params] = useSearchParams();
  // En el sitio del entrenador o en el de los alumnos hay un solo ingreso; en la app completa, dos pestañas.
  const fixed: Portal | null = APP_MODE === 'trainer' ? 'trainer' : APP_MODE === 'student' ? 'student' : null;
  const [chosen, setChosen] = useState<Portal>(() => initialPortal(params.get('como')));
  const portal: Portal = fixed ?? chosen;

  if (status === 'authenticated') return <Navigate to={from} replace />;

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: Portal = chosen === 'student' ? 'trainer' : 'student';
    setChosen(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <AuthShell title="Ingresar" subtitle={SUBTITLE[portal]} footer={<Link to="/recuperar">Olvidé mi contraseña</Link>}>
      {fixed === null && (
        <div className={s.tabs} role="tablist" aria-label="Tipo de cuenta" onKeyDown={onKeyDown}>
          {TABS.map((t) => (
            <button key={t.id} id={`tab-${t.id}`} type="button" role="tab" className={s.tab} aria-selected={chosen === t.id} aria-controls="login-panel" tabIndex={chosen === t.id ? 0 : -1} onClick={() => setChosen(t.id)}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      )}
      <div id="login-panel" role={fixed === null ? 'tabpanel' : undefined} aria-labelledby={fixed === null ? `tab-${portal}` : undefined}>
        {/* key={portal}: al cambiar de pestaña el formulario arranca vacío, así no se arrastran datos entre un ingreso y el otro. */}
        <LoginForm key={portal} portal={portal} />
      </div>
    </AuthShell>
  );
}
