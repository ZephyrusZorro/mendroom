import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { Store } from '../server/store.ts';
import { createApp } from '../server/app.ts';

test('real HTTP API persists intake, rejects malformed payloads, origins, hosts and stale edits', async () => {
  const store = new Store(':memory:');
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  const post = (url: string, body: unknown, extra = {}) => fetch(base + url, { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(base + '/api/health')).status, 200);
    assert.equal((await post('/api/sessions', { title: 'x' })).status, 400);
    const res = await post('/api/sessions', { title: 'Real repair event', location: 'Hall', date: '2026-11-07', durationMinutes: 120 });
    assert.equal(res.status, 201);
    const s = await res.json();
    const v = await (await post(`/api/sessions/${s.id}/volunteers`, { name: 'Sam', skills: ['electrical'], available: true })).json();
    const t = await (await post(`/api/sessions/${s.id}/tickets`, { visitor: '=Alex', item: 'Lamp', issue: 'Broken switch', category: 'electrical', estimatedMinutes: 30, reviewRequired: false })).json();
    const path = `/api/sessions/${s.id}/tickets/${t.id}/actions`;
    assert.equal((await post(path, { action: 'assign', version: 1, volunteerId: v.id }, { origin: 'https://evil.example' })).status, 403);
    // Node fetch replaces Host on the wire; use the actual HTTP boundary for this case.
    const hostileHostStatus = await new Promise<number>(resolve => {
      const req = request(base + '/api/sessions', { headers: { host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode!); });
      req.end();
    });
    assert.equal(hostileHostStatus, 403);
    assert.equal((await post(path, { action: 'assign', version: 1, volunteerId: v.id })).status, 200);
    assert.equal((await post(path, { action: 'note', version: 1, note: 'Stale write' })).status, 409);
    assert.equal((await post(path, { action: 'complete', version: 2, outcome: 'repaired', note: ' ' })).status, 400);
    const data = await (await fetch(base + `/api/sessions/${s.id}`)).json();
    assert.equal(data.tickets[0].status, 'in-progress');
    assert.equal((await fetch(base + '/api/not-a-route')).status, 404);
    const malformed = await fetch(base + '/api/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(malformed.status, 400);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); store.close(); }
});
