import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import s from '../components/ui/ui.module.css';

type ToastTone = 'success' | 'danger' | 'info';
interface Toast { id: number; tone: ToastTone; message: string }
interface ToastApi { notify: (message: string, tone?: ToastTone) => void }

const ToastContext = createContext<ToastApi | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = nextId++;
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const api = useMemo(() => ({ notify }), [notify]);
  const Icon = { success: CircleCheck, danger: CircleAlert, info: Info };
  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Región en vivo: los lectores de pantalla anuncian los avisos. */}
      <div className={s.toasts} role="status" aria-live="polite">
        {toasts.map((t) => { const I = Icon[t.tone]; return <div key={t.id} className={`${s.toast} ${s[`tone-${t.tone}`]}`}><I size={18} aria-hidden="true" style={{ flexShrink: 0 }} />{t.message}</div>; })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}
