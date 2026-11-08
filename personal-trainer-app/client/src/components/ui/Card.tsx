import type { ReactNode } from 'react';
import s from './ui.module.css';

export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={[s.card, className].filter(Boolean).join(' ')}>
      {(title || actions) && <header className={s.cardHead}>{title && <h2 className={s.cardTitle}>{title}</h2>}{actions}</header>}
      {children}
    </section>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={`${s.card} ${s.stat}`}>
      <div className={s.statTop}><span>{label}</span>{icon && <span className={s.statIcon} aria-hidden="true">{icon}</span>}</div>
      <div className={s.statValue}>{value}</div>
      {hint && <div className={s.statHint}>{hint}</div>}
    </div>
  );
}
