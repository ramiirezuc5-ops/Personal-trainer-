import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '../src/components/ui/Button';
import { Modal } from '../src/components/ui/Modal';
import { AppLayout } from '../src/layouts/AppLayout';
import Dashboard from '../src/pages/Dashboard';
import StudentCreate from '../src/pages/StudentCreate';
import StudentDetail from '../src/pages/StudentDetail';
import StudentHome from '../src/pages/StudentHome';
import Students from '../src/pages/Students';
import { ApiError } from '../src/services/api';
import type { Dashboard as DashboardData } from '../src/types/api';
import { makeStudent, mocks, renderApp, studentUser } from './utils';

vi.mock('../src/services/endpoints', async () => (await import('./mocks')).mocks);
beforeEach(() => vi.clearAllMocks());

const page = (items = [makeStudent()], over = {}) => ({ items, total: items.length, page: 1, limit: 15, pages: 1, ...over });

describe('listado de alumnos', () => {
  it('muestra los alumnos con su estado como texto', async () => {
    mocks.studentsApi.list.mockResolvedValue(page([makeStudent(), makeStudent({ id: 's2', firstName: 'Luis', lastName: 'Gómez', status: 'pending' })]));
    renderApp(<Students />, { route: '/alumnos' });
    expect(await screen.findByText('Pérez, Ana')).toBeInTheDocument();
    expect(screen.getByText('Gómez, Luis')).toBeInTheDocument();
    expect(screen.getByText('Pendiente', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Pérez, Ana/ })[0]).toHaveAttribute('href', '/alumnos/s1');
  });

  it('busca con retardo y vuelve a la página 1', async () => {
    mocks.studentsApi.list.mockResolvedValue(page());
    renderApp(<Students />, { route: '/alumnos?page=3' });
    await screen.findByText('Pérez, Ana');
    await userEvent.type(screen.getByLabelText('Buscar'), 'ana');
    await waitFor(() => expect(mocks.studentsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'ana', page: 1 })));
  });

  it('estado vacío sin alumnos invita a registrar; con filtros ofrece limpiarlos', async () => {
    mocks.studentsApi.list.mockResolvedValue(page([], { total: 0 }));
    const { unmount } = renderApp(<Students />, { route: '/alumnos' });
    expect(await screen.findByText('Todavía no tenés alumnos')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /alumno/i }).some((l) => l.getAttribute('href') === '/alumnos/nuevo')).toBe(true);
    unmount();
    renderApp(<Students />, { route: '/alumnos?status=inactive' });
    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar filtros' })).toBeInTheDocument();
  });

  it('error con botón para reintentar', async () => {
    mocks.studentsApi.list.mockRejectedValueOnce(new ApiError(0, 'NETWORK_ERROR', 'No hay conexión con el servidor.')).mockResolvedValue(page());
    renderApp(<Students />, { route: '/alumnos' });
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Pérez, Ana')).toBeInTheDocument();
  });

  it('paginación: "Siguiente" pide la página 2', async () => {
    mocks.studentsApi.list.mockResolvedValue(page([makeStudent()], { total: 30, pages: 2 }));
    renderApp(<Students />, { route: '/alumnos' });
    await screen.findByText('Pérez, Ana');
    expect(screen.getByRole('button', { name: /Anterior/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(mocks.studentsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
  });
});

describe('alta de alumno', () => {
  it('valida campos obligatorios y formato de correo sin llamar a la API', async () => {
    renderApp(<StudentCreate />, { route: '/alumnos/nuevo' });
    await userEvent.click(await screen.findByRole('button', { name: /Crear alumno/ }));
    expect(await screen.findByText('Ingresá el nombre.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá el apellido.')).toBeInTheDocument();
    expect(screen.getByText('Ingresá el correo electrónico.')).toBeInTheDocument();
    expect(mocks.studentsApi.create).not.toHaveBeenCalled();
  });

  it('envía datos limpios (sin fecha vacía) y confirma el alta', async () => {
    mocks.studentsApi.create.mockResolvedValue(makeStudent({ firstName: 'Nuevo', lastName: 'Alumno', email: 'nuevo@test.com', status: 'pending' }));
    renderApp(<StudentCreate />, { route: '/alumnos/nuevo' });
    await userEvent.type(await screen.findByLabelText(/^Nombre/), '  Nuevo ');
    await userEvent.type(screen.getByLabelText(/^Apellido/), 'Alumno');
    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'nuevo@test.com');
    await userEvent.click(screen.getByRole('button', { name: /Crear alumno/ }));
    expect(await screen.findByText(/quedó registrado como pendiente/)).toBeInTheDocument();
    const sent = mocks.studentsApi.create.mock.calls[0][0];
    expect(sent).toMatchObject({ firstName: 'Nuevo', lastName: 'Alumno', email: 'nuevo@test.com' });
    expect('birthDate' in sent).toBe(false);
    expect(screen.getByRole('link', { name: /Ver ficha/ })).toHaveAttribute('href', '/alumnos/s1');
  });

  it('muestra "correo ya registrado" junto al campo', async () => {
    mocks.studentsApi.create.mockRejectedValue(new ApiError(409, 'EMAIL_TAKEN', 'Ya existe'));
    renderApp(<StudentCreate />, { route: '/alumnos/nuevo' });
    await userEvent.type(await screen.findByLabelText(/^Nombre/), 'A');
    await userEvent.type(screen.getByLabelText(/^Apellido/), 'B');
    await userEvent.type(screen.getByLabelText(/Correo electrónico/), 'dup@test.com');
    await userEvent.click(screen.getByRole('button', { name: /Crear alumno/ }));
    expect(await screen.findByText('Ya existe una cuenta con ese correo.')).toBeInTheDocument();
  });
});

describe('ficha del alumno', () => {
  it('desactivar exige confirmación y avisa que no se borra el historial', async () => {
    mocks.studentsApi.get.mockResolvedValue(makeStudent());
    mocks.studentsApi.deactivate.mockResolvedValue(makeStudent({ status: 'inactive' }));
    renderApp(<StudentDetail />, { route: '/alumnos/s1', path: '/alumnos/:id' });
    await userEvent.click(await screen.findByRole('button', { name: 'Desactivar' }));
    const dialog = await screen.findByRole('dialog', { name: '¿Desactivar alumno?' });
    expect(within(dialog).getByText(/No se borra nada/)).toBeInTheDocument();
    expect(mocks.studentsApi.deactivate).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(mocks.studentsApi.deactivate).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => expect(mocks.studentsApi.deactivate).toHaveBeenCalledWith('s1'));
    expect(await screen.findByText('Alumno desactivado.')).toBeInTheDocument();
  });

  it('un alumno pendiente permite reenviar la invitación; uno inactivo, reactivarlo', async () => {
    mocks.studentsApi.get.mockResolvedValue(makeStudent({ status: 'pending' }));
    mocks.studentsApi.resendInvite.mockResolvedValue({ message: 'ok' });
    const { unmount } = renderApp(<StudentDetail />, { route: '/alumnos/s1', path: '/alumnos/:id' });
    await userEvent.click(await screen.findByRole('button', { name: 'Reenviar invitación' }));
    await waitFor(() => expect(mocks.studentsApi.resendInvite).toHaveBeenCalledWith('s1'));
    unmount();
    mocks.studentsApi.get.mockResolvedValue(makeStudent({ status: 'inactive' }));
    renderApp(<StudentDetail />, { route: '/alumnos/s1', path: '/alumnos/:id' });
    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Desactivar' })).not.toBeInTheDocument();
  });

  it('un alumno inexistente (o de otro entrenador) muestra un mensaje claro', async () => {
    mocks.studentsApi.get.mockRejectedValue(new ApiError(404, 'STUDENT_NOT_FOUND', 'x'));
    renderApp(<StudentDetail />, { route: '/alumnos/zzz', path: '/alumnos/:id' });
    expect(await screen.findByText('No encontramos a este alumno.')).toBeInTheDocument();
  });

  it('editar guarda los cambios por la API', async () => {
    mocks.studentsApi.get.mockResolvedValue(makeStudent());
    mocks.studentsApi.update.mockResolvedValue(makeStudent({ goal: 'Correr 10k' }));
    renderApp(<StudentDetail />, { route: '/alumnos/s1', path: '/alumnos/:id' });
    await userEvent.click(await screen.findByRole('button', { name: 'Editar' }));
    const goal = screen.getByLabelText(/Objetivo de entrenamiento/);
    await userEvent.clear(goal); await userEvent.type(goal, 'Correr 10k');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(mocks.studentsApi.update).toHaveBeenCalledWith('s1', expect.objectContaining({ goal: 'Correr 10k' })));
  });
});

const dash = (over: Partial<DashboardData> = {}): DashboardData => ({
  timezone: 'America/Argentina/Buenos_Aires', isEmpty: false,
  students: { active: 4, pending: 1, inactive: 0, total: 5, new30d: 2 },
  todayAppointments: [], membershipsDueSoon: [],
  pendingPayments: { count: 1, totals: { ARS: 25000 }, items: [{ _id: 'm1', due: 25000, currency: 'ARS', endDate: '2026-03-01T00:00:00Z', student: { id: 's1', firstName: 'Ana', lastName: 'Pérez' } }] },
  revenueThisMonth: [{ currency: 'ARS', total: 60000, count: 2 }],
  charts: { months: ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'], newStudentsByMonth: [0, 1, 0, 0, 1, 2], revenueByMonth: [{ currency: 'ARS', values: [0, 0, 0, 0, 20000, 40000] }] },
  recentActivity: [{ type: 'pago', at: '2026-06-01T10:00:00Z', text: 'Pago de Ana Pérez: ARS 60000' }], ...over,
});

describe('panel del entrenador', () => {
  it('sin alumnos muestra el estado vacío con la acción de registrar (sin cifras inventadas)', async () => {
    mocks.dashboardApi.get.mockResolvedValue(dash({ isEmpty: true, students: { active: 0, pending: 0, inactive: 0, total: 0, new30d: 0 } }));
    renderApp(<Dashboard />);
    expect(await screen.findByText(/Todavía no tenés alumnos/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Registrar primer alumno/ })).toHaveAttribute('href', '/alumnos/nuevo');
    expect(screen.queryByText('Alumnos activos')).not.toBeInTheDocument();
  });

  it('muestra las métricas reales y resúmenes de texto para los gráficos', async () => {
    mocks.dashboardApi.get.mockResolvedValue(dash());
    renderApp(<Dashboard />);
    expect(await screen.findByText('Alumnos activos')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText(/2 nuevos en 30 días · 1 sin activar/)).toBeInTheDocument();
    expect(screen.getByText('No tenés turnos para hoy.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ana Pérez' })).toHaveAttribute('href', '/alumnos/s1');
    expect(screen.getByRole('figure', { name: 'Alumnos nuevos por mes' })).toBeInTheDocument();
    expect(screen.getByText(/ene 26: 0, feb 26: 1/)).toBeInTheDocument();
  });

  it('error de carga con reintento', async () => {
    mocks.dashboardApi.get.mockRejectedValueOnce(new ApiError(500, 'INTERNAL_ERROR', 'Falló')).mockResolvedValue(dash());
    renderApp(<Dashboard />);
    expect(await screen.findByText('No pudimos cargar la información')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Alumnos activos')).toBeInTheDocument();
  });
});

describe('diálogo accesible', () => {
  function Demo() {
    const [open, setOpen] = useState(false);
    return <><Button onClick={() => setOpen(true)}>Abrir</Button><Modal open={open} title="Título" onClose={() => setOpen(false)} footer={<Button onClick={() => setOpen(false)}>Cerrar</Button>}>Contenido</Modal></>;
  }
  it('enfoca el diálogo, atrapa el foco, se cierra con Escape y devuelve el foco', async () => {
    renderApp(<Demo />);
    const opener = await screen.findByRole('button', { name: 'Abrir' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Título' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus(); // el foco no escapa del diálogo
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe('navegación', () => {
  it('el entrenador ve Panel y Alumnos; abre y cierra el menú móvil con aria-expanded', async () => {
    renderApp(<AppLayout />, { route: '/' , path: '/' });
    expect(await screen.findAllByRole('link', { name: 'Alumnos' })).not.toHaveLength(0);
    const menu = screen.getByRole('button', { name: 'Abrir menú' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });

  it('el alumno solo ve su perfil y puede cerrar sesión', async () => {
    mocks.authApi.logout.mockResolvedValue(null);
    renderApp(<AppLayout />, { user: studentUser, route: '/', path: '/' });
    await screen.findAllByRole('link', { name: 'Mi perfil' });
    expect(screen.queryByRole('link', { name: 'Alumnos' })).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Cerrar sesión' })[0]);
    await waitFor(() => expect(mocks.authApi.logout).toHaveBeenCalled());
  });
});

describe('perfil del alumno', () => {
  it('solo permite editar los campos habilitados y envía únicamente esos', async () => {
    mocks.meApi.profile.mockResolvedValue(makeStudent({ studentEditableFields: ['phone'], phone: '111' }));
    mocks.meApi.updateProfile.mockResolvedValue(makeStudent({ phone: '222' }));
    renderApp(<StudentHome />, { user: studentUser });
    const phone = await screen.findByLabelText('Teléfono');
    expect(screen.queryByLabelText('Objetivo')).not.toBeInTheDocument();
    expect(screen.queryByText('nota')).not.toBeInTheDocument(); // las observaciones del entrenador no se muestran
    await userEvent.clear(phone); await userEvent.type(phone, '222');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(mocks.meApi.updateProfile).toHaveBeenCalledWith({ phone: '222' }));
  });

  it('es honesto sobre lo que todavía no está disponible', async () => {
    mocks.meApi.profile.mockResolvedValue(makeStudent({ studentEditableFields: [] }));
    renderApp(<StudentHome />, { user: studentUser });
    expect(await screen.findByText(/estarán disponibles en las próximas versiones/)).toBeInTheDocument();
    expect(screen.getByText(/no habilitó la edición/)).toBeInTheDocument();
  });
});
