import { ClipboardList, Dumbbell, LayoutDashboard, LogOut, Menu, UserRound, Users, Wallet, X, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';
import s from './layout.module.css';

interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean }
const TRAINER_NAV: NavItem[] = [
  { to: '/', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/alumnos', label: 'Alumnos', icon: Users },
  { to: '/rutinas', label: 'Rutinas', icon: ClipboardList },
  { to: '/ejercicios', label: 'Ejercicios', icon: Dumbbell },
];
const STUDENT_NAV: NavItem[] = [
  { to: '/mi-rutina', label: 'Mi rutina', icon: ClipboardList },
  { to: '/mis-pagos', label: 'Mi mensualidad', icon: Wallet },
  { to: '/mi-perfil', label: 'Mi perfil', icon: UserRound, end: true },
];

function Brand() {
  return <NavLink to="/" className={s.brand}><span className={s.brandMark}><Dumbbell size={18} aria-hidden="true" /></span>Personal Trainer</NavLink>;
}

function NavList({ items }: { items: NavItem[] }) {
  return (
    <nav className={s.nav} aria-label="Navegación principal">
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={s.link}><Icon size={18} aria-hidden="true" />{label}</NavLink>
      ))}
    </nav>
  );
}

function UserBox() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div className={s.user}>
      <span className={s.avatar} aria-hidden="true">{initials(user.name)}</span>
      <div className={s.userInfo}><div className={s.userName}>{user.name}</div><div className={s.userRole}>{user.role === 'trainer' ? 'Entrenador' : 'Alumno'}</div></div>
      <Button variant="ghost" size="sm" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={() => void logout()}><LogOut size={18} aria-hidden="true" /></Button>
    </div>
  );
}

export function AppLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const menuBtn = useRef<HTMLButtonElement>(null);
  const items = user?.role === 'trainer' ? TRAINER_NAV : STUDENT_NAV;

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); menuBtn.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={s.shell}>
      <a href="#contenido" className="skip-link">Saltar al contenido</a>

      <aside className={s.sidebar}><Brand /><NavList items={items} /><UserBox /></aside>

      <div className={s.content}>
        <header className={s.topbar}>
          <Brand />
          <button ref={menuBtn} className={s.iconBtn} aria-label="Abrir menú" aria-expanded={open} aria-controls="menu-movil" onClick={() => setOpen(true)}><Menu size={22} aria-hidden="true" /></button>
        </header>
        <main id="contenido" className={s.main} tabIndex={-1}><Outlet /></main>
      </div>

      {open && <div className={s.drawerOverlay} onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside id="menu-movil" className={`${s.drawer} ${open ? s.open : ''}`} aria-label="Menú" aria-hidden={!open}>
        <div className={s.drawerHead}><Brand /><button className={s.iconBtn} aria-label="Cerrar menú" onClick={() => { setOpen(false); menuBtn.current?.focus(); }}><X size={22} aria-hidden="true" /></button></div>
        <NavList items={items} />
        <UserBox />
      </aside>
    </div>
  );
}
