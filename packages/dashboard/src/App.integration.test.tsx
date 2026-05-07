import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeAll } from 'vitest';
import App from './App';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings';

// Stub HTMLCanvasElement.getContext for jsdom (the force graph uses canvas).
beforeAll(() => {
  // Minimal canvas 2d stub — enough for ForceGraph2D not to crash during render.
  // We do not assert on canvas drawing, only on DOM reactivity around it.
  HTMLCanvasElement.prototype.getContext = (() => ({
    fillRect: () => {}, clearRect: () => {}, getImageData: () => ({ data: [] }),
    putImageData: () => {}, createImageData: () => [],
    setTransform: () => {}, drawImage: () => {}, save: () => {}, restore: () => {},
    beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, closePath: () => {},
    stroke: () => {}, translate: () => {}, scale: () => {}, rotate: () => {},
    arc: () => {}, fill: () => {}, measureText: () => ({ width: 0 }),
    transform: () => {}, rect: () => {}, clip: () => {}, fillText: () => {},
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    canvas: { width: 0, height: 0 },
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

describe('Memory Cosmos App', () => {
  it('connects, accepts a new memory, and reflects it in stats', async () => {
    const uniqueContent = `Cosmos test ${Date.now()}`;
    const uniqueTag = `cosmostag${Date.now()}`;

    const connectionBuilder = DbConnection.builder()
      .withUri('ws://localhost:3000')
      .withDatabaseName('compound-memory-dev');

    render(
      <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
        <App />
      </SpacetimeDBProvider>
    );

    // Connecting screen visible initially
    expect(screen.getByText(/Aligning to Spacetime/i)).toBeInTheDocument();

    // Wait for connection (replaced by main UI)
    await waitFor(
      () => expect(screen.queryByText(/Aligning to Spacetime/i)).not.toBeInTheDocument(),
      { timeout: 10000 }
    );

    // Snapshot initial memory count from the stats badge.
    // The badge renders as <span><span class="num">N</span>memories</span> —
    // matcher must traverse split text.
    const findCount = (): number => {
      const candidates = screen.getAllByText((_t, el) => {
        const text = el?.textContent ?? '';
        return /^\s*\d+\s*memories\s*$/.test(text);
      });
      const text = candidates[0]?.textContent ?? '';
      return parseInt(text.match(/(\d+)/)?.[1] ?? '0', 10);
    };
    const before = findCount();

    // Fill the bottom command palette and submit
    const contentInput = screen.getByRole('textbox', { name: /memory content input/i });
    await userEvent.type(contentInput, uniqueContent);
    const tagInput = screen.getByRole('textbox', { name: /entity tags input/i });
    await userEvent.type(tagInput, uniqueTag);
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    // Stats badge should reflect the new memory shortly after the reducer applies
    await waitFor(
      () => {
        const after = findCount();
        expect(after).toBeGreaterThan(before);
      },
      { timeout: 10000 }
    );
  });
});
