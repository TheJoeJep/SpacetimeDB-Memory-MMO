import '@testing-library/jest-dom';

// jsdom polyfills for ForceGraph2D / browser APIs not present in node test env
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}
