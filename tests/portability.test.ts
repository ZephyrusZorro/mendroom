import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { Store } from '../server/store.ts';
import { createApp } from '../server/app.ts';
import { sessionCsv } from '../server/export.ts';

const event = {
  title: 'Local repair session',
  location: 'Hall',
  date: '2026-11-07',
  durationMinutes: 180,
};
const item = {
  visitor: ' =HYPERLINK("bad")',
  item: 'Lamp, "green"',
  issue: 'Broken\nswitch',
  category: 'electrical',
  estimatedMinutes: 30,
  reviewRequired: false,
};

test('portable backup restores a separate copy with remapped references and intact history', () => {
  const store = new Store(':memory:');
  try {
    const s = store.createSession(event);
    const v = store.addVolunteer(s.id, { name: 'Sam', skills: ['electrical'], available: true });
    const t = store.addTicket(s.id, item);
    store.act(s.id, t.id, { action: 'assign', version: 1, volunteerId: v.id });
    const backup = store.exportSession(s.id);
    const copy = store.importSession(JSON.parse(JSON.stringify(backup)));
    const restored = store.readSession(copy.id);
    assert.notEqual(copy.id, s.id);
    assert.equal(store.listSessions().length, 2);
    assert.equal(restored.tickets[0].item, 'Lamp, "green"');
    assert.notEqual(restored.tickets[0].id, t.id);
    assert.equal(restored.tickets[0].volunteerId, restored.volunteers[0].id);
    assert.equal(
      restored.activities.filter((a) => a.ticketId === restored.tickets[0].id).length,
      2,
    );
    assert.equal(store.readSession(s.id).tickets[0].version, 2);
  } finally {
    store.close();
  }
});

test('invalid foreign references, duplicate identities, active collisions and oversized notes import nothing', () => {
  const store = new Store(':memory:');
  try {
    const s = store.createSession(event);
    const v = store.addVolunteer(s.id, { name: 'Sam', skills: ['electrical'], available: true });
    const t = store.addTicket(s.id, item);
    store.act(s.id, t.id, { action: 'assign', version: 1, volunteerId: v.id });
    const backup = store.exportSession(s.id);
    const missing = structuredClone(backup);
    missing.volunteers = [];
    assert.throws(() => store.importSession(missing), /reference/i);
    const duplicate = structuredClone(backup);
    duplicate.tickets.push(duplicate.tickets[0]);
    assert.throws(() => store.importSession(duplicate), /duplicate/i);
    const collision = structuredClone(backup);
    collision.tickets.push({
      ...collision.tickets[0],
      id: 'd9685b47-7ef8-4d0a-90ae-b1cd00a03e39',
      number: 2,
      queueOrder: 2,
    });
    assert.throws(() => store.importSession(collision), /active/i);
    const tooLong = structuredClone(backup);
    tooLong.tickets[0].notes = 'x'.repeat(20_001);
    assert.throws(() => store.importSession(tooLong));
    assert.equal(store.listSessions().length, 1);
    assert.equal(store.readSession(s.id).tickets.length, 1);
  } finally {
    store.close();
  }
});

test('CSV quotes commas/newlines and neutralises spreadsheet formulas including leading whitespace', () => {
  const store = new Store(':memory:');
  try {
    const s = store.createSession(event);
    store.addTicket(s.id, item);
    const csv = sessionCsv(store.readSession(s.id));
    assert.ok(csv.includes('"Lamp, ""green"""'));
    assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
    assert.ok(csv.includes('"Broken\nswitch"'));
    assert.ok(csv.startsWith('\uFEFF'));
  } finally {
    store.close();
  }
});

test('download and restore endpoints work over HTTP and preserve existing sessions', async () => {
  const store = new Store(':memory:');
  const s = store.createSession(event);
  const server = createApp(store, true).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const download = await fetch(`${base}/api/sessions/${s.id}/backup`);
    assert.equal(download.status, 200);
    assert.ok(download.headers.get('content-disposition')?.includes('attachment'));
    const backup = await download.json();
    const response = await fetch(base + '/api/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(backup),
    });
    assert.equal(response.status, 201);
    assert.equal(store.listSessions().length, 2);
    assert.equal((await fetch(`${base}/api/sessions/${s.id}/report.csv`)).status, 200);
    const bad = await fetch(base + '/api/restore', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"format":"mendroom"}',
    });
    assert.equal(bad.status, 400);
    assert.equal(store.listSessions().length, 2);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
  }
});
