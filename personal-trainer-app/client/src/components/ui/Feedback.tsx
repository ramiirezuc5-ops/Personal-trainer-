import { CircleAlert, CircleCheck, Info, LoaderCircle, TriangleAlert, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { ApiError } from '../../services/api';
import { Button } from './Button';
import s from './ui.module.css';

export function Spinner({ size = 18 }: { size?: number }) { return <LoaderCircle size={size} className={s.spin} aria-hidden="true" />; }

export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return <div className={s.loading} role="status" aria-live="polite"><Spinner />{label}</div>;
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className={s.state}>
      {icon && <div className={s.stateIcon} aria-hidden="true">{icon}</div>}
      <h3 className={s.stateTitle}>{title}</h3>
      {description && <p className={s.stateText}>{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = error instanceof ApiError && error.status === 0;
  const message = error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
  return (
    <div className={s.state} role="alert">
      <div className={s.stateIcon} aria-hidden="true">{offline ? <WifiOff size={24} /> : <TriangleAlert size={24} />}</div>
      <h3 className={s.stateTitle}>{offline ? 'Sin conexión' : 'No pudimos cargar la información'}</h3>
      <p className={s.stateText}>{message}</p>
      {error instanceof ApiError && error.requestId && <p className={s.hint}>Código de referencia: {error.requestId}</p>}
      {onRetry && <Button variant="secondary" onClick={onRetry}>Reintentar</Button>}
    </div>
  );
}

const ICONS = { success: CircleCheck, danger: CircleAlert, info: Info, warning: TriangleAlert } as const;
export function Alert({ tone = 'info', children }: { tone?: keyof typeof ICONS; children: ReactNode }) {
  const Icon = ICONS[tone];
  return <div className={`${s.alert} ${s[`tone-${tone}`]}`} role={tone === 'danger' ? 'alert' : 'status'}><Icon size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} /><div>{children}</div></div>;
}
