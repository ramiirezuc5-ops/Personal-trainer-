import type { ReactNode } from 'react';
import s from './ui.module.css';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
// El estado siempre se comunica con texto (no solo con color).
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={[s.badge, tone !== 'neutral' ? s[`tone-${tone}`] : ''].filter(Boolean).join(' ')}>{children}</span>;
}
