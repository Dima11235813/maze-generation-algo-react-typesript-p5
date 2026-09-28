/** Development-only logger; compiled to a no-op in production builds. */
export const log: (...args: unknown[]) => void = import.meta.env.DEV
  ? (...args) => {
      console.debug('[maze]', ...args);
    }
  : () => undefined;
