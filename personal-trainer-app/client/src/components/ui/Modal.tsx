import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';
import s from './ui.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }

// Diálogo accesible: role="dialog", foco atrapado, Escape para cerrar y devolución del foco al elemento que lo abrió.
export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0]; const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className={s.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={s.modal} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId} className={s.modalTitle}>{title}</h2>
        {children}
        {footer && <div className={s.modalFoot}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

interface ConfirmProps { open: boolean; title: string; message: ReactNode; confirmLabel: string; danger?: boolean; loading?: boolean; onConfirm: () => void; onCancel: () => void }
// Confirmación obligatoria antes de acciones importantes (p. ej. desactivar un alumno).
export function ConfirmDialog({ open, title, message, confirmLabel, danger, loading, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Modal open={open} title={title} onClose={onCancel} footer={<><Button variant="ghost" onClick={onCancel} disabled={loading}>Cancelar</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button></>}>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>{message}</div>
    </Modal>
  );
}
