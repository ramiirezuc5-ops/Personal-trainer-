import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import s from './ui.module.css';

export function PageHeader({ title, description, actions, back }: { title: string; description?: string; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <>
      {back && <Link to={back.to} className={s.back}><ChevronLeft size={16} aria-hidden="true" />{back.label}</Link>}
      <div className={s.pageHead}>
        <div><h1 className={s.pageTitle}>{title}</h1>{description && <p className={s.pageDesc}>{description}</p>}</div>
        {actions && <div className={s.pageActions}>{actions}</div>}
      </div>
    </>
  );
}
