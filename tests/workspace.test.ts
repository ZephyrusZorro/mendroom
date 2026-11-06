import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Store } from '../server/store.ts';
import { createApp } from '../server/app.ts';
import { loadWorkspace } from '../src/workspace.ts';

test('a session remembered from another database falls back to an existing session', async () => {
  const store = new Store(':memory:');
  const s = store.createSession({
    title: 'Available session',
    location: 'Hall',
    date: '2026-11-07',
    durationMinutes: 180,
  });
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  try {
    const result = await loadWorkspace(
      '60b7397c-f804-4659-b111-c7ba8a3b546c',
      `http://127.0.0.1:${addr.port}`,
    );
    assert.equal(result.selectedId, s.id);
    assert.equal(result.sessions.length, 1);
    assert.equal(result.data?.session.title, 'Available session');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
  }
});
