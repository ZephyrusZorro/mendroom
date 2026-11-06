import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.ts';
import { forecast } from '../shared/matching.ts';

const event = { title: 'Saturday repair café', location: 'Community hall', date: '2026-11-07', durationMinutes: 180 };
const item = { visitor: 'Alex', item: 'Desk lamp', issue: 'Switch does not work', category: 'electrical', estimatedMinutes: 30, reviewRequired: false };

test('repair lifecycle survives closing and reopening the real database', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mendroom-'));
  let store = new Store(join(dir, 'test.sqlite'));
  try {
    const session = store.createSession(event);
    const volunteer = store.addVolunteer(session.id, { name: 'Sam', skills: ['electrical'], available: true });
    const ticket = store.addTicket(session.id, item);
    const assigned = store.act(session.id, ticket.id, { action: 'assign', version: 1, volunteerId: volunteer.id });
    assert.equal(assigned.status, 'in-progress');
    const done = store.act(session.id, ticket.id, { action: 'complete', version: 2, outcome: 'repaired', note: 'Replaced the worn switch.' });
    assert.equal(done.status, 'repaired');
    store.close();
    store = new Store(join(dir, 'test.sqlite'));
    assert.equal(store.readSession(session.id).tickets[0].notes, 'Replaced the worn switch.');
    assert.equal(store.readSession(session.id).activities.length, 4);
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});

test('assignment rejects wrong skills, unavailable and busy volunteers, review holds and stale edits', () => {
  const store = new Store(':memory:');
  try {
    const s = store.createSession(event);
    const textile = store.addVolunteer(s.id, { name: 'Jo', skills: ['textiles'], available: true });
    const sam = store.addVolunteer(s.id, { name: 'Sam', skills: ['electrical'], available: false });
    const t = store.addTicket(s.id, item);
    assert.throws(() => store.act(s.id, t.id, { action: 'assign', version: 1, volunteerId: textile.id }), /skill/i);
    assert.throws(() => store.act(s.id, t.id, { action: 'assign', version: 1, volunteerId: sam.id }), /available/i);
    store.editVolunteer(s.id, sam.id, { version: 1, available: true });
    store.act(s.id, t.id, { action: 'assign', version: 1, volunteerId: sam.id });
    const second = store.addTicket(s.id, { ...item, reviewRequired: true });
    assert.throws(() => store.act(s.id, second.id, { action: 'assign', version: 1, volunteerId: sam.id }), /review/i);
    store.act(s.id, second.id, { action: 'clear-review', version: 1, note: 'Coordinator reviewed intake.' });
    assert.throws(() => store.act(s.id, second.id, { action: 'assign', version: 2, volunteerId: sam.id }), /busy/i);
    assert.throws(() => store.act(s.id, t.id, { action: 'note', version: 1, note: 'Stale note' }), /changed/i);
    assert.throws(() => store.act(s.id, t.id, { action: 'return', version: 2 }), /transition/i);
    const other = store.createSession(event);
    assert.throws(() => store.act(other.id, t.id, { action: 'assign', version: 2, volunteerId: sam.id }), /not found/i);
  } finally { store.close(); }
});

test('parts follow-up releases a volunteer and returns a ticket to the end of the queue', () => {
  const store = new Store(':memory:');
  try {
    const s = store.createSession(event);
    const v = store.addVolunteer(s.id, { name: 'Sam', skills: ['electrical'], available: true });
    const t = store.addTicket(s.id, item);
    store.act(s.id, t.id, { action: 'assign', version: 1, volunteerId: v.id });
    const parts = store.act(s.id, t.id, { action: 'parts', version: 2, note: 'Bring a matching switch.', partsNeeded: 'One switch' });
    assert.equal(parts.volunteerId, null);
    store.addTicket(s.id, item);
    const returned = store.act(s.id, t.id, { action: 'return', version: 3 });
    assert.equal(returned.status, 'queued');
    assert.equal(returned.number, 1);
    assert.ok(returned.queueOrder > store.readSession(s.id).tickets.find(x => x.number === 2)!.queueOrder);
  } finally { store.close(); }
});

test('matching preserves intake order, excludes breaks and holds, and accounts for current work', () => {
  const store = new Store(':memory:');
  try {
    const s = store.createSession(event);
    const v = store.addVolunteer(s.id, { name: 'Sam', skills: ['electrical'], available: true });
    const a = store.addTicket(s.id, item);
    const b = store.addTicket(s.id, item);
    const hold = store.addTicket(s.id, { ...item, reviewRequired: true });
    store.act(s.id, a.id, { action: 'assign', version: 1, volunteerId: v.id });
    const data = store.readSession(s.id);
    const assigned = data.tickets.find(t => t.id === a.id)!;
    const result = forecast(data.tickets, data.volunteers, new Date(assigned.startedAt!).getTime());
    assert.equal(result.find(f => f.ticketId === b.id)?.waitMinutes, 30);
    assert.equal(result.find(f => f.ticketId === hold.id)?.reason, 'Coordinator review needed');
    store.editVolunteer(s.id, v.id, { version: 1, available: false });
    assert.equal(forecast(data.tickets, store.readSession(s.id).volunteers).find(f => f.ticketId === b.id)?.waitMinutes, null);
  } finally { store.close(); }
});

test('validation rejects impossible dates and malformed input without partial writes', () => {
  const store = new Store(':memory:');
  try {
    assert.throws(() => store.createSession({ ...event, date: '2026-02-30' }));
    const s = store.createSession(event);
    assert.throws(() => store.addTicket(s.id, { ...item, estimatedMinutes: -1 }));
    assert.throws(() => store.addVolunteer(s.id, { name: '', skills: [], available: true }));
    assert.equal(store.readSession(s.id).tickets.length, 0);
  } finally { store.close(); }
});
