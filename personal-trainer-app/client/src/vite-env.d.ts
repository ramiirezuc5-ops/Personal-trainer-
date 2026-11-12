/// <reference types="vite/client" />

// Lo define vite.config.ts según el modo con que se arranca o compila (ver scripts de package.json).
declare const __APP_MODE__: 'trainer' | 'student' | 'all';

interface ImportMetaEnv {
  /** Dirección de la app de los alumnos (se usa en el panel del entrenador). */
  readonly VITE_STUDENT_APP_URL?: string;
  /** Dirección del panel del entrenador (se usa en la app de los alumnos). */
  readonly VITE_TRAINER_APP_URL?: string;
}
