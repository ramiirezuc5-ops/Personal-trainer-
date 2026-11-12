import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { APP_MODE } from './appMode';
import { LoadingBlock } from './components/ui/Feedback';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './layouts/AppLayout';
import { ModeGate, ProtectedRoute, RoleGate } from './layouts/guards';

const Login = lazy(() => import('./pages/Login'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Students = lazy(() => import('./pages/Students'));
const StudentCreate = lazy(() => import('./pages/StudentCreate'));
const StudentDetail = lazy(() => import('./pages/StudentDetail'));
const StudentHome = lazy(() => import('./pages/StudentHome'));
const Exercises = lazy(() => import('./pages/Exercises'));
const Routines = lazy(() => import('./pages/Routines'));
const RoutineCreate = lazy(() => import('./pages/RoutineCreate'));
const RoutineDetail = lazy(() => import('./pages/RoutineDetail'));
const MyRoutines = lazy(() => import('./pages/MyRoutines'));
const MyRoutineDetail = lazy(() => import('./pages/MyRoutineDetail'));
const WorkoutLogPage = lazy(() => import('./pages/WorkoutLogPage'));
const MyBilling = lazy(() => import('./pages/MyBilling'));
const Payments = lazy(() => import('./pages/Payments'));
const Plans = lazy(() => import('./pages/Plans'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Home() {
  const { user } = useAuth();
  if (user?.role === 'trainer') return <Dashboard />;
  // El alumno aterriza en su rutina; su perfil queda en /mi-perfil.
  return user?.role === 'student' ? <Navigate to="/mi-rutina" replace /> : null;
}

// Cada sitio solo registra las rutas de su público.
const SHOW_TRAINER = APP_MODE !== 'student';
const SHOW_STUDENT = APP_MODE !== 'trainer';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Suspense fallback={<div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><LoadingBlock /></div>}>
            <Routes>
              <Route path="/ingresar" element={<Login />} />
              <Route path="/recuperar" element={<ForgotPassword />} />
              <Route path="/restablecer-contrasena" element={<ResetPassword />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<ModeGate />}>
                  <Route element={<AppLayout />}>
                    <Route index element={<Home />} />
                    {SHOW_TRAINER && (
                      <Route element={<RoleGate role="trainer" />}>
                        <Route path="alumnos" element={<Students />} />
                        <Route path="alumnos/nuevo" element={<StudentCreate />} />
                        <Route path="alumnos/:id" element={<StudentDetail />} />
                        <Route path="ejercicios" element={<Exercises />} />
                        <Route path="rutinas" element={<Routines />} />
                        <Route path="rutinas/nueva" element={<RoutineCreate />} />
                        <Route path="rutinas/:id" element={<RoutineDetail />} />
                        <Route path="pagos" element={<Payments />} />
                        <Route path="planes" element={<Plans />} />
                      </Route>
                    )}
                    {SHOW_STUDENT && (
                      <Route element={<RoleGate role="student" />}>
                        <Route path="mi-rutina" element={<MyRoutines />} />
                        <Route path="mi-rutina/:id" element={<MyRoutineDetail />} />
                        <Route path="mi-rutina/:id/registrar/:dayId" element={<WorkoutLogPage />} />
                        <Route path="mis-pagos" element={<MyBilling />} />
                        <Route path="mi-perfil" element={<StudentHome />} />
                      </Route>
                    )}
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
