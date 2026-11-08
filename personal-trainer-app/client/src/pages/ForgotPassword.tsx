import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button, LinkButton } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { Alert } from '../components/ui/Feedback';
import { AuthShell } from '../layouts/AuthShell';
import s from '../layouts/layout.module.css';
import { ApiError } from '../services/api';
import { authApi } from '../services/endpoints';
import { isEmail } from '../utils/format';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isEmail(email.trim())) { setError('Ingresá un correo válido (ej.: nombre@correo.com).'); return; }
    setError(''); setLoading(true);
    try { await authApi.forgot(email.trim()); setDone(true); }
    catch (err) { setError(err instanceof ApiError ? err.message : 'No pudimos procesar la solicitud.'); }
    finally { setLoading(false); }
  }

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Te enviaremos un enlace para elegir una nueva contraseña." footer={<Link to="/ingresar">Volver a ingresar</Link>}>
      {done ? (
        <>
          {/* Mensaje idéntico exista o no la cuenta: no revela qué correos están registrados. */}
          <Alert tone="success">Si el correo corresponde a una cuenta activa, te enviamos las instrucciones. Revisá también la carpeta de spam. El enlace vence en 1 hora.</Alert>
          <LinkButton to="/ingresar" variant="secondary">Volver a ingresar</LinkButton>
        </>
      ) : (
        <form className={s.form} onSubmit={(e) => void onSubmit(e)} noValidate>
          <TextField label="Correo electrónico" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} required />
          <Button type="submit" loading={loading}>Enviar enlace</Button>
        </form>
      )}
    </AuthShell>
  );
}
