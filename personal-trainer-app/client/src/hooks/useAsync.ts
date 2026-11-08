import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> { data: T | null; error: unknown; loading: boolean; reload: () => void }

// Carga de datos con estados de carga/error y reintento. Ignora respuestas de peticiones ya reemplazadas.
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: unknown; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fn().then(
      (data) => { if (!cancelled) setState({ data, error: null, loading: false }); },
      (error: unknown) => { if (!cancelled) setState((s) => ({ ...s, error, loading: false })); },
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` lo define quien llama
  }, [...deps, tick]);

  return { ...state, reload };
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
