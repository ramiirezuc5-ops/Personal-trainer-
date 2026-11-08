import { Dumbbell } from 'lucide-react';
import type { ReactNode } from 'react';
import s from './layout.module.css';

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className={s.authWrap}>
      <div className={s.authCard}>
        <div className={s.authHead}>
          <span className={s.brandMark} aria-hidden="true"><Dumbbell size={18} /></span>
          <h1 className={s.authTitle}>{title}</h1>
          {subtitle && <p className={s.authSub}>{subtitle}</p>}
        </div>
        {children}
        {footer && <div className={s.authFoot}>{footer}</div>}
      </div>
    </main>
  );
}
