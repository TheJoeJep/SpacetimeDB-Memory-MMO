import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import App from './App';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from './module_bindings';

describe('Compound memory App', () => {
  it('adds a memory with an entity tag, shows it, and deletes it', async () => {
    const uniqueContent = `Test memory ${Date.now()}`;
    const uniqueTag = `testtag${Date.now()}`;

    const connectionBuilder = DbConnection.builder()
      .withUri('ws://localhost:3000')
      .withDatabaseName('compound-memory-dev');

    render(
      <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
        <App />
      </SpacetimeDBProvider>
    );

    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    await waitFor(
      () => expect(screen.queryByText(/Connecting/i)).not.toBeInTheDocument(),
      { timeout: 10000 }
    );

    const contentInput = screen.getByRole('textbox', { name: /memory content input/i });
    await userEvent.type(contentInput, uniqueContent);
    const tagInput = screen.getByRole('textbox', { name: /entity tags input/i });
    await userEvent.type(tagInput, uniqueTag);
    const saveButton = screen.getByRole('button', { name: /^save$/i });
    await userEvent.click(saveButton);

    await waitFor(
      () => expect(screen.getByText(uniqueContent)).toBeInTheDocument(),
      { timeout: 10000 }
    );
    // Tag appears in multiple places (sidebar + tag chip) — assert at least one
    await waitFor(
      () => expect(screen.getAllByText(uniqueTag).length).toBeGreaterThan(0),
      { timeout: 10000 }
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete memory/i });
    expect(deleteButtons.length).toBeGreaterThan(0);
    await userEvent.click(deleteButtons[0]);

    await waitFor(
      () => expect(screen.queryByText(uniqueContent)).not.toBeInTheDocument(),
      { timeout: 10000 }
    );
  });
});
