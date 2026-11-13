import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from '../src/pages/Login';
import ResetPassword from '../src/pages/ResetPassword';
import ForgotPassword from '../src/pages/ForgotPassword';
import { ApiError } from '../src/services/api';
import { ProtectedRoute, RoleGate } from '../src/layouts/guards';
import { mocks, renderApp, studentUser } from './utils';

vi.mock('../src/services/endpoints', async () => (await import('./mocks')).mocks);

beforeEach(() => vi.clearAllMocks());

describe('Login', () => {
  it('valida los campos antes de llamar a la API', async () => {
    renderApp(<Login />, { user: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText('Ingresá tu correo electrónico.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá tu contraseña.')).toBeInTheDocument();
    expect(mocks.authApi.login).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'no-es-correo');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText(/Revisá el formato del correo/)).toBeInTheDocument();
  });

  it('asocia cada error a su campo (accesibilidad)', async () => {
    renderApp(<Login />, { user: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Ingresar' }));
    const email = screen.getByLabelText(/Correo electrónico/);
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.getElementById(email.getAttribute('aria-describedby')!)).toHaveTextContent('Ingresá tu correo');
  });

  it('muestra el mensaje del servidor si las credenciales son incorrectas', async () => {
    mocks.authApi.login.mockRejectedValue(new ApiError(401, 'INVALID_CREDENTIALS', 'x'));
    renderApp(<Login />, { user: null });
    await userEvent.type(await screen.findByLabelText(/Correo electrónico/), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'mala12345');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Correo o contraseña incorrectos.');
  });

  it('informa cuentas pendientes y bloqueadas con mensajes claros', async () => {
    mocks.authApi.login.mockRejectedValueOnce(new ApiError(403, 'ACCOUNT_PENDING', 'x'));
    renderApp(<Login />, { user: null });
    await userEvent.type(await screen.findByLabelText(/Correo electrónico/), 'a@b.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(await screen.findByText(/Todavía no activaste tu cuenta/)).toBeInTheDocument();
  });

  it('con credenciales correctas inicia sesión y sale de la pantalla de ingreso', async () => {
    mocks.authApi.login.mockResolvedValue({ user: studentUser });
    renderApp(<Login />, { user: null, route: '/ingresar', path: '/ingresar' });
    await userEvent.type(await screen.findByLabelText(/Correo electrónico/), 'ana@test.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'Clave12345seg');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(mocks.authApi.login).toHaveBeenCalledWith('ana@test.com', 'Clave12345seg', 'student'));
    expect(await screen.findByText('INICIO')).toBeInTheDocument();
  });

  it('tiene pestañas Alumno y Entrenador, y envía la que se eligió', async () => {
    mocks.authApi.login.mockResolvedValue({ user: studentUser });
    renderApp(<Login />, { user: null, route: '/ingresar', path: '/ingresar' });
    expect(await screen.findByRole('tab', { name: /Alumno/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /Entrenador/ }));
    expect(screen.getByRole('tab', { name: /Entrenador/ })).toHaveAttribute('aria-selected', 'true');
    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'prof@test.com');
    await userEvent.type(screen.getByLabelText(/Contraseña/), 'Clave12345seg');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    await waitFor(() => expect(mocks.authApi.login).toHaveBeenCalledWith('prof@test.com', 'Clave12345seg', 'trainer'));
  });
});

describe('recuperación y activación de contraseña', () => {
  it('forgot: el mensaje es el mismo exista o no la cuenta', async () => {
    mocks.authApi.forgot.mockResolvedValue({ message: 'ok' });
    renderApp(<ForgotPassword />, { user: null });
    await userEvent.type(await screen.findByLabelText(/Correo electrónico/), 'cualquiera@test.com');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));
    expect(await screen.findByText(/Si el correo corresponde a una cuenta activa/)).toBeInTheDocument();
  });

  it('exige contraseña fuerte y que ambas coincidan', async () => {
    renderApp(<ResetPassword />, { user: null, route: '/r?token=' + 't'.repeat(30), path: '/r' });
    await userEvent.type(await screen.findByLabelText(/Nueva contraseña/), 'corta');
    await userEvent.type(screen.getByLabelText(/Repetir contraseña/), 'otra');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar contraseña' }));
    expect(await screen.findByText('Debe tener al menos 10 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(mocks.authApi.reset).not.toHaveBeenCalled();
  });

  it('invitación: usa el texto de activación y confirma el éxito', async () => {
    mocks.authApi.reset.mockResolvedValue({ message: 'ok' });
    renderApp(<ResetPassword />, { user: null, route: '/r?token=' + 't'.repeat(30) + '&invitacion=1', path: '/r' });
    expect(await screen.findByRole('heading', { name: 'Activá tu cuenta' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/Nueva contraseña/), 'ClaveSegura2026');
    await userEvent.type(screen.getByLabelText(/Repetir contraseña/), 'ClaveSegura2026');
    await userEvent.click(screen.getByRole('button', { name: 'Activar cuenta' }));
    expect(await screen.findByText(/Tu contraseña quedó guardada/)).toBeInTheDocument();
    expect(mocks.authApi.reset).toHaveBeenCalledWith('t'.repeat(30), 'ClaveSegura2026');
  });

  it('un enlace vencido explica qué hacer; sin token muestra error', async () => {
    mocks.authApi.reset.mockRejectedValue(new ApiError(400, 'TOKEN_INVALID', 'x'));
    renderApp(<ResetPassword />, { user: null, route: '/r?token=' + 't'.repeat(30) + '&invitacion=1', path: '/r' });
    await userEvent.type(await screen.findByLabelText(/Nueva contraseña/), 'ClaveSegura2026');
    await userEvent.type(screen.getByLabelText(/Repetir contraseña/), 'ClaveSegura2026');
    await userEvent.click(screen.getByRole('button', { name: 'Activar cuenta' }));
    expect(await screen.findByText(/Pedile a tu entrenador que te reenvíe la invitación/)).toBeInTheDocument();
  });

  it('sin token en la URL no muestra el formulario', async () => {
    renderApp(<ResetPassword />, { user: null, route: '/r', path: '/r' });
    expect(await screen.findByText(/enlace está incompleto/)).toBeInTheDocument();
  });
});

describe('rutas protegidas', () => {
  it('un visitante sin sesión es enviado al ingreso', async () => {
    renderApp(<ProtectedRoute />, { user: null });
    expect(await screen.findByText('PANTALLA-INGRESO')).toBeInTheDocument();
  });
  it('un alumno no accede a pantallas del entrenador', async () => {
    renderApp(<RoleGate role="trainer" />, { user: studentUser, route: '/alumnos', path: '/alumnos' });
    expect(await screen.findByText('INICIO')).toBeInTheDocument();
  });
});
