import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { APP_MODE } from '../appMode';
import { useAuth } from '../context/AuthContext';
import { AuthShell } from '../layouts/AuthShell';
import s from '../layouts/layout.module.css';
import { ApiError } from '../services/api';
import { isEmail } from '../utils/format';

const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  ACCOUNT_LOCKED: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.',
  ACCOUNT_PENDING: 'Todavía no activaste tu cuenta. Usá el enlace de la invitación que te llegó por correo.',
  ACCOUNT_INACTIVE: 'Tu cuenta está inactiva. Contactá a tu entrenador.',
  RATE_LIMITED: 'Demasiados intentos. Esperá unos minutos e intentá de nuevo.',
};

const SUBTITLE = {
  trainer: 'Panel del entrenador: gestioná tus alumnos, rutinas y pagos.',
  student: 'Accedé a tu rutina, tus entrenamientos y tu mensualidad.',
  all: 'Accedé a tu cuenta para gestionar tu entrenamiento.',
} as const;

export default function Login() {
  const { login, status } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  if (status === 'authenticated') return <Navigate to={from} replace />;

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
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setServerError(err instanceof ApiError ? (MESSAGES[err.code] ?? err.message) : 'No pudimos iniciar sesión. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Ingresar" subtitle={SUBTITLE[APP_MODE]} footer={<Link to="/recuperar">Olvidé mi contraseña</Link>}>
      <form className={s.form} onSubmit={(e) => void onSubmit(e)} noValidate>
        {serverError && <Alert tone="danger">{serverError}</Alert>}
        <TextField label="Correo electrónico" type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} required />
        <TextField label="Contraseña" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} required />
        <Button type="submit" loading={loading}>Ingresar</Button>
      </form>
    </AuthShell>
  );
}
