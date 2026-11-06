import test from 'node:test';
import assert from 'node:assert/strict';
import { Store } from '../server/store.ts';

const event = {
  title: 'Boundary session',
  location: 'Hall',
  date: '2026-11-07',
  durationMinutes: 180,
};
const intake = {
  visitor: 'Alex',
  item: 'Lamp',
  issue: 'Switch broken',
  category: 'electrical',
  estimatedMinutes: 30,
  reviewRequired: false,
};

test('completion cannot exceed the portable accumulated-note limit and rolls back the outcome', () => {
  const store = new Store(':memory:');
  try {
    const s = store.createSession(event);
    const v = store.addVolunteer(s.id, { name: 'Sam', skills: ['electrical'], available: true });
    const t = store.addTicket(s.id, intake);
    store.act(s.id, t.id, { action: 'assign', version: 1, volunteerId: v.id });
    for (let n = 0; n < 10; n++)
      store.act(s.id, t.id, { action: 'note', version: n + 2, note: 'x'.repeat(1998) });
    assert.throws(
      () =>
        store.act(s.id, t.id, {
          action: 'complete',
          version: 12,
          outcome: 'repaired',
          note: 'Repair completed.',
        }),
      /notes.*full/i,
    );
    assert.equal(store.readSession(s.id).tickets[0].status, 'in-progress');
    assert.equal(store.readSession(s.id).tickets[0].version, 12);
    assert.doesNotThrow(() => store.importSession(store.exportSession(s.id)));
  } finally {
    store.close();
  }
});

test('volunteer capacity rejects the extra write while every accepted record remains restorable', () => {
  const store = new Store(':memory:');
  try {
    const s = store.createSession(event);
    for (let n = 0; n < 250; n++)
      store.addVolunteer(s.id, { name: `Volunteer ${n}`, skills: ['general'], available: true });
    assert.throws(
      () =>
        store.addVolunteer(s.id, { name: 'One too many', skills: ['general'], available: true }),
      /volunteer.*limit/i,
    );
    assert.equal(store.readSession(s.id).volunteers.length, 250);
    assert.doesNotThrow(() => store.importSession(store.exportSession(s.id)));
  } finally {
    store.close();
  }
});

test('large valid sessions roundtrip through the real HTTP byte boundary', async () => {
  const { once } = await import('node:events');
  const { createApp } = await import('../server/app.ts');
  const store = new Store(':memory:');
  const s = store.createSession(event);
  for (let n = 0; n < 400; n++) {
    const t = store.addTicket(s.id, { ...intake, issue: 'i'.repeat(1200) });
    for (let version = 1; version <= 3; version++)
      store.act(s.id, t.id, { action: 'note', version, note: 'n'.repeat(2000) });
  }
  const backup = store.exportSession(s.id);
  const json = JSON.stringify(backup);
  assert.ok(Buffer.byteLength(json) > 5 * 1024 * 1024);
  const server = createApp(store).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const addr = server.address();
  assert.ok(addr && typeof addr !== 'string');
  try {
    const response = await fetch(`http://127.0.0.1:${addr.port}/api/restore`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: json,
    });
    assert.equal(response.status, 201);
    const restored = await response.json();
    assert.equal(store.readSession(restored.id).tickets.length, 400);
    assert.deepEqual(
      store.readSession(restored.id).activities.map((a) => a.message),
      store.readSession(s.id).activities.map((a) => a.message),
    );
    let capacityReached = false;
    for (let pass = 0; pass < 2 && !capacityReached; pass++) {
      for (const ticket of store.readSession(s.id).tickets) {
        try {
          store.act(s.id, ticket.id, {
            action: 'note',
            version: ticket.version,
            note: '界'.repeat(2000),
          });
        } catch (e) {
          assert.match((e as Error).message, /portable size limit/);
          capacityReached = true;
          break;
        }
      }
    }
    assert.ok(
      capacityReached,
      'UTF-8 byte budget must reject a write before export becomes too large',
    );
    const fullBackup = store.exportSession(s.id);
    assert.ok(Buffer.byteLength(JSON.stringify(fullBackup)) <= 8 * 1024 * 1024);
    const secondCopy = store.importSession(fullBackup);
    const thirdCopy = store.importSession(store.exportSession(secondCopy.id));
    assert.equal(store.readSession(thirdCopy.id).activities.length, fullBackup.activities.length);
    assert.equal(store.readSession(thirdCopy.id).tickets[0].notes, fullBackup.tickets[0].notes);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
    store.close();
  }
});

test('database failure during restore rolls back the entire copy', () => {
  const store = new Store(':memory:');
  try {
    const s = store.createSession(event);
    store.addTicket(s.id, intake);
    const backup = store.exportSession(s.id);
    store.db.exec(
      "CREATE TRIGGER simulated_write_failure BEFORE INSERT ON tickets BEGIN SELECT RAISE(ABORT, 'simulated write failure'); END;",
    );
    assert.throws(() => store.importSession(backup), /simulated write failure/);
    assert.equal(store.listSessions().length, 1);
    assert.equal(store.readSession(s.id).tickets.length, 1);
  } finally {
    store.close();
  }
});
