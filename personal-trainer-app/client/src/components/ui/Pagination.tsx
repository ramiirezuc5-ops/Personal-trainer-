import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import s from './ui.module.css';

export function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  if (total === 0) return null;
  return (
    <nav className={s.pager} aria-label="Paginación">
      <span aria-live="polite">Página {page} de {pages} · {total} {total === 1 ? 'resultado' : 'resultados'}</span>
      <div className={s.pagerBtns}>
        <Button variant="secondary" size="sm" icon={<ChevronLeft size={16} aria-hidden="true" />} disabled={page <= 1} onClick={() => onChange(page - 1)}>Anterior</Button>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>Siguiente<ChevronRight size={16} aria-hidden="true" /></Button>
      </div>
    </nav>
  );
}
