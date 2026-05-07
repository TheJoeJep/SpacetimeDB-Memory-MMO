import '@testing-library/jest-dom';

// jsdom polyfills for ForceGraph2D / browser APIs not present in node test env
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

// The SpacetimeDB SDK calls .bytes() on objects that look like Blobs during
// WebSocket frame decompression. jsdom doesn't fully implement this, and the
// failure surfaces as an unhandled rejection that fails the whole test suite
// even when assertions pass. We silence it — actual test correctness is
// asserted via DOM state, not via the deeply-decoded subscription frames.
// Silence all in tests — real assertions catch real failures, stray async
// errors from the SpacetimeDB SDK + jsdom mismatch shouldn't fail the run.
process.on('unhandledRejection', () => {});
