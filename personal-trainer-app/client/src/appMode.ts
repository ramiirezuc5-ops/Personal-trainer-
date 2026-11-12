/**
 * Un mismo proyecto se publica como dos sitios:
 *  - 'trainer' → panel del entrenador
 *  - 'student' → app de los alumnos
 *  - 'all'     → todo junto (modo clásico, también el que usan las pruebas)
 * El modo lo fija vite.config.ts según `--mode` (npm run dev:trainer, build:student, etc.).
 */
export type AppMode = 'trainer' | 'student' | 'all';

export const APP_MODE: AppMode = typeof __APP_MODE__ !== 'undefined' ? __APP_MODE__ : 'all';

export const APP_TITLE: Record<AppMode, string> = { trainer: 'Panel del entrenador', student: 'Mi entrenamiento', all: 'Personal Trainer App' };

const DEV = import.meta.env.DEV;
/** Dirección del OTRO sitio, para ofrecer un enlace cuando alguien entra al equivocado. */
export const OTHER_APP_URL: string | undefined =
  APP_MODE === 'trainer' ? (import.meta.env.VITE_STUDENT_APP_URL || (DEV ? 'http://localhost:5174' : undefined))
  : APP_MODE === 'student' ? (import.meta.env.VITE_TRAINER_APP_URL || (DEV ? 'http://localhost:5173' : undefined))
  : undefined;
