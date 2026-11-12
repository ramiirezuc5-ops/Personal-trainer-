import { useEffect, useRef } from 'react';

/**
 * Vuelve a pedir los datos cuando la persona regresa a la pestaña o a la app.
 * Así el alumno ve lo que el entrenador cambió (rutinas, pagos, etc.) sin tener que recargar a mano.
 * Se limita a una vez cada `minMs` para no saturar al servidor.
 */
export function useRefreshOnFocus(refresh: () => void, minMs = 10_000) {
  const last = useRef(Date.now());
  const cb = useRef(refresh);
  cb.current = refresh;
  useEffect(() => {
    const run = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last.current < minMs) return;
      last.current = Date.now();
      cb.current();
    };
    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    return () => { document.removeEventListener('visibilitychange', run); window.removeEventListener('focus', run); };
  }, [minMs]);
}
