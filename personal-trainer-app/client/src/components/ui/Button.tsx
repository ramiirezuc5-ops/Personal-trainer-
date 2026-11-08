import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import s from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const cls = (variant: Variant, size: 'md' | 'sm', extra?: string) => [s.btn, s[variant], size === 'sm' ? s.sm : '', extra ?? ''].filter(Boolean).join(' ');

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: 'md' | 'sm'; loading?: boolean; icon?: ReactNode }

// Estados: hover, focus (anillo visible), loading (deshabilita y avisa a lectores de pantalla) y disabled.
export function Button({ variant = 'primary', size = 'md', loading = false, icon, children, disabled, className, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={cls(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <LoaderCircle size={16} className={s.spin} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
}

interface LinkButtonProps extends LinkProps { variant?: Variant; size?: 'md' | 'sm'; icon?: ReactNode }
export function LinkButton({ variant = 'primary', size = 'md', icon, children, className, ...rest }: LinkButtonProps) {
  return <Link className={cls(variant, size, className)} {...rest}>{icon}{children}</Link>;
}
