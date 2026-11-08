import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => { cleanup(); document.cookie = 'pt_csrf=; Max-Age=0; path=/'; });

// jsdom no trae ResizeObserver (lo usan los gráficos).
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: typeof RO }).ResizeObserver = RO;
