import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, LinkButton } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { AuthShell } from '../layouts/AuthShell';
import s from '../layouts/layout.module.css';
import { ApiError, fieldErrors } from '../services/api';
import { authApi } from '../services/endpoints';

export function validatePassword(p: string): string | null {
  if (p.length < 10) return 'Debe tener al menos 10 caracteres.';
  if (p.length > 72) return 'No puede superar los 72 caracteres.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Debe combinar letras y números.';
  return null;
}

// Sirve para recuperar la contraseña y para activar una cuenta invitada por el entrenador.
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const invitation = params.get('invitacion') === '1';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [serverError, setServerError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = invitation ? 'Activá tu cuenta' : 'Nueva contraseña';

  if (!token) {
    return <AuthShell title={title}><Alert tone="danger">El enlace está incompleto. Abrilo de nuevo desde el correo que recibiste.</Alert><LinkButton to="/recuperar" variant="secondary">Pedir un enlace nuevo</LinkButton></AuthShell>;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    const pwError = validatePassword(password);
    if (pwError) next.password = pwError;
    if (confirm !== password) next.confirm = 'Las contraseñas no coinciden.';
    setErrors(next); setServerError('');
    if (Object.keys(next).length) return;

    setLoading(true);
    try { await authApi.reset(token, password); setDone(true); }
    catch (err) {
      const fe = fieldErrors(err);
      if (fe.password) setErrors({ password: fe.password });
      else if (err instanceof ApiError && err.code === 'TOKEN_INVALID') setServerError(invitation ? 'El enlace de invitación venció o ya fue usado. Pedile a tu entrenador que te reenvíe la invitación.' : 'El enlace venció o ya fue usado. Pedí uno nuevo.');
      else setServerError(err instanceof ApiError ? err.message : 'No pudimos guardar la contraseña.');
    } finally { setLoading(false); }
  }

  return (
    <AuthShell title={title} subtitle={invitation ? 'Elegí una contraseña para empezar a usar tu cuenta.' : 'Elegí una contraseña nueva para tu cuenta.'} footer={!done && <Link to="/ingresar">Volver a ingresar</Link>}>
      {done ? (
        <>
          <Alert tone="success">Tu contraseña quedó guardada. Ya podés ingresar.</Alert>
          <LinkButton to="/ingresar">Ir a ingresar</LinkButton>
        </>
      ) : (
        <form className={s.form} onSubmit={(e) => void onSubmit(e)} noValidate>
          {serverError && <Alert tone="danger">{serverError} {!invitation && <Link to="/recuperar">Pedir un enlace nuevo</Link>}</Alert>}
          <TextField label="Nueva contraseña" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} hint="Mínimo 10 caracteres, con letras y números." required />
          <TextField label="Repetir contraseña" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} required />
          <Button type="submit" loading={loading}>{invitation ? 'Activar cuenta' : 'Guardar contraseña'}</Button>
        </form>
      )}
    </AuthShell>
  );
}
