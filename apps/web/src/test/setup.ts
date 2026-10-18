import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Pages are lazy routes (L-40): the first `findBy...` in a file waits for Vite to transform the
// page module, which under a full parallel run can exceed RTL's 1 s default (L-41).
configure({ asyncUtilTimeout: 5_000 });

// jsdom lacks ResizeObserver; report a fixed host size so pages can size their grids.
class FakeResizeObserver {
  private readonly cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb;
  }
  observe(target: Element): void {
    const entry = {
      target,
      contentRect: {
        width: 800,
        height: 600,
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 800,
        bottom: 600,
      },
    } as unknown as ResizeObserverEntry;
    this.cb([entry], this);
  }
  unobserve(): void {}
  disconnect(): void {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = FakeResizeObserver;
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  });
}

// jsdom's `crypto` has no `subtle`; MazeDocument hashing needs SHA-256.
if (!globalThis.crypto?.subtle) {
  const specifier = 'node:crypto';
  const mod = (await import(/* @vite-ignore */ specifier)) as { webcrypto: Crypto };
  Object.defineProperty(globalThis, 'crypto', { value: mod.webcrypto, configurable: true });
}

// TanStack Router calls window.scrollTo on navigation; jsdom does not implement it.
Object.defineProperty(window, 'scrollTo', { value: () => undefined, writable: true });

// Radix Select captures the pointer and scrolls the chosen option into view; jsdom has neither.
if (typeof Element !== 'undefined') {
  const proto = Element.prototype as Partial<Element>;
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => undefined;
  proto.releasePointerCapture ??= () => undefined;
  proto.scrollIntoView ??= () => undefined;
}
