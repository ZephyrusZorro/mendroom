import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { actionInput, sessionInput, ticketInput, volunteerInput, volunteerEdit, type Activity, type Session, type SessionData, type SessionSummary, type Ticket, type Volunteer } from '../shared/model.ts';
import { forecast } from '../shared/matching.ts';

export class AppError extends Error { constructor(public status: number, message: string) { super(message); } }
const fail = (message: string, status = 409): never => { throw new AppError(status, message); };

export class Store {
  readonly db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS volunteers (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, data TEXT NOT NULL) STRICT;
      CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, volunteer_id TEXT REFERENCES volunteers(id), status TEXT NOT NULL, data TEXT NOT NULL) STRICT;
      CREATE UNIQUE INDEX IF NOT EXISTS one_active_repair ON tickets(volunteer_id) WHERE status='in-progress';
      CREATE INDEX IF NOT EXISTS tickets_session ON tickets(session_id);
      CREATE INDEX IF NOT EXISTS volunteers_session ON volunteers(session_id);
      CREATE TABLE IF NOT EXISTS activities (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, data TEXT NOT NULL) STRICT;
      CREATE INDEX IF NOT EXISTS activities_session ON activities(session_id);
      PRAGMA user_version=1;`);
  }
  close() { this.db.close(); }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  private get<T>(table: 'sessions' | 'volunteers' | 'tickets', id: string): T {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id) as { data: string } | undefined;
    if (!row) fail('Record not found', 404);
    return JSON.parse(row!.data) as T;
  }
  private all<T>(table: 'sessions' | 'volunteers' | 'tickets' | 'activities', sessionId?: string): T[] {
    const rows = sessionId ? this.db.prepare(`SELECT data FROM ${table} WHERE session_id=? ORDER BY rowid`).all(sessionId) : this.db.prepare(`SELECT data FROM ${table} ORDER BY rowid`).all();
    return rows.map(row => JSON.parse(row.data as string) as T);
  }
  private activity(sessionId: string, ticketId: string | null, message: string) {
    const activity: Activity = { id: randomUUID(), sessionId, ticketId, message, createdAt: new Date().toISOString() };
    this.db.prepare('INSERT INTO activities VALUES(?,?,?)').run(activity.id, sessionId, JSON.stringify(activity));
  }
  listSessions(): SessionSummary[] {
    return this.all<Session>('sessions').map(s => {
      const tickets = this.all<Ticket>('tickets', s.id);
      return { ...s, total: tickets.length, repaired: tickets.filter(t => t.status === 'repaired').length, active: tickets.filter(t => t.status === 'in-progress').length };
    }).reverse();
  }
  createSession(input: unknown, sample = false): Session {
    const data = sessionInput.parse(input);
    const s: Session = { ...data, id: randomUUID(), sample, createdAt: new Date().toISOString() };
    this.db.prepare('INSERT INTO sessions VALUES(?,?)').run(s.id, JSON.stringify(s));
    return s;
  }
  readSession(id: string): SessionData {
    const session = this.get<Session>('sessions', id);
    const volunteers = this.all<Volunteer>('volunteers', id);
    const tickets = this.all<Ticket>('tickets', id);
    const activities = this.all<Activity>('activities', id).reverse();
    return { session, volunteers, tickets, activities, forecast: forecast(tickets, volunteers) };
  }
  addVolunteer(sessionId: string, input: unknown): Volunteer {
    const data = volunteerInput.parse(input);
    return this.transaction(() => {
      this.get<Session>('sessions', sessionId);
      const v: Volunteer = { ...data, id: randomUUID(), sessionId, version: 1 };
      this.db.prepare('INSERT INTO volunteers VALUES(?,?,?)').run(v.id, sessionId, JSON.stringify(v));
      this.activity(sessionId, null, `${v.name} joined the volunteer team`);
      return v;
    });
  }
  editVolunteer(sessionId: string, id: string, input: unknown): Volunteer {
    const data = volunteerEdit.parse(input);
    return this.transaction(() => {
      const v = this.get<Volunteer>('volunteers', id);
      if (v.sessionId !== sessionId) fail('Record not found', 404);
      if (v.version !== data.version) fail('This record changed. Refresh and try again.');
      const updated = { ...v, available: data.available, version: v.version + 1 };
      this.db.prepare('UPDATE volunteers SET data=? WHERE id=?').run(JSON.stringify(updated), id);
      this.activity(sessionId, null, `${v.name} is ${updated.available ? 'available' : 'on a break'}`);
      return updated;
    });
  }
  addTicket(sessionId: string, input: unknown): Ticket {
    const data = ticketInput.parse(input);
    return this.transaction(() => {
      this.get<Session>('sessions', sessionId);
      const all = this.all<Ticket>('tickets', sessionId);
      const t: Ticket = { ...data, id: randomUUID(), sessionId, number: Math.max(0, ...all.map(t => t.number)) + 1, queueOrder: Math.max(0, ...all.map(t => t.queueOrder)) + 1, status: 'queued', volunteerId: null, notes: '', partsNeeded: '', createdAt: new Date().toISOString(), startedAt: null, finishedAt: null, version: 1 };
      this.db.prepare('INSERT INTO tickets VALUES(?,?,?,?,?)').run(t.id, sessionId, null, t.status, JSON.stringify(t));
      this.activity(sessionId, t.id, `${t.item} checked in as #${String(t.number).padStart(3, '0')}`);
      return t;
    });
  }
  act(sessionId: string, id: string, input: unknown): Ticket {
    const action = actionInput.parse(input);
    return this.transaction(() => {
      const t = this.get<Ticket>('tickets', id);
      if (t.sessionId !== sessionId) fail('Record not found', 404);
      if (t.version !== action.version) fail('This record changed. Refresh and try again.');
      let message = '';
      switch (action.action) {
        case 'assign': {
          if (t.status !== 'queued') fail('This transition requires a queued ticket.');
          if (t.reviewRequired) fail('Coordinator review is required before assignment.');
          const v = this.get<Volunteer>('volunteers', action.volunteerId);
          if (v.sessionId !== sessionId) fail('Volunteer not found', 404);
          if (!v.skills.includes(t.category)) fail('Volunteer needs a matching skill.');
          if (!v.available) fail('Volunteer is not available.');
          if (this.all<Ticket>('tickets', sessionId).some(x => x.status === 'in-progress' && x.volunteerId === v.id)) fail('Volunteer is busy with another repair.');
          t.status = 'in-progress'; t.volunteerId = v.id; t.startedAt = new Date().toISOString();
          message = `${t.item} assigned to ${v.name}`;
          break;
        }
        case 'complete':
          if (t.status !== 'in-progress') fail('This transition requires a repair in progress.');
          t.status = action.outcome; t.notes = [t.notes, action.note].filter(Boolean).join('\n\n'); t.finishedAt = new Date().toISOString();
          message = `${t.item}: ${action.outcome === 'repaired' ? 'repaired' : 'not repaired'} — ${action.note}`;
          break;
        case 'parts':
          if (t.status !== 'in-progress') fail('This transition requires a repair in progress.');
          t.status = 'waiting-parts'; t.volunteerId = null; t.partsNeeded = action.partsNeeded; t.notes = [t.notes, action.note].filter(Boolean).join('\n\n');
          message = `${t.item} needs parts: ${action.partsNeeded}`;
          break;
        case 'return':
          if (t.status !== 'waiting-parts') fail('This transition requires a ticket waiting for parts.');
          t.status = 'queued'; t.startedAt = null; t.finishedAt = null; t.partsNeeded = '';
          t.queueOrder = Math.max(...this.all<Ticket>('tickets', sessionId).map(x => x.queueOrder)) + 1;
          message = `${t.item} returned to the queue; parts received`;
          break;
        case 'clear-review':
          if (t.status !== 'queued' || !t.reviewRequired) fail('This transition requires a queued ticket on review hold.');
          t.reviewRequired = false; t.notes = [t.notes, action.note].filter(Boolean).join('\n\n');
          message = `Coordinator reviewed ${t.item}: ${action.note}`;
          break;
        case 'note':
          t.notes = [t.notes, action.note].filter(Boolean).join('\n\n');
          if (t.notes.length > 20_000) fail('Notes are full. Export the record before adding more.', 400);
          message = `Note for ${t.item}: ${action.note}`;
      }
      t.version++;
      this.db.prepare('UPDATE tickets SET volunteer_id=?,status=?,data=? WHERE id=?').run(t.volunteerId, t.status, JSON.stringify(t), id);
      this.activity(sessionId, id, message);
      return t;
    });
  }
  createSample(): Session {
    const existing = this.listSessions().find(s => s.sample);
    if (existing) return existing;
    const s = this.createSession({ title: 'Saturday at the repair café', location: 'The neighbourhood workshop', date: '2026-11-07', durationMinutes: 180 }, true);
    const maya = this.addVolunteer(s.id, { name: 'Maya Patel', skills: ['electrical', 'general'], available: true });
    const theo = this.addVolunteer(s.id, { name: 'Theo Martin', skills: ['bicycles', 'woodwork'], available: true });
    this.addVolunteer(s.id, { name: 'Robin Chen', skills: ['textiles', 'general'], available: true });
    this.addVolunteer(s.id, { name: 'Jamie Brooks', skills: ['electrical'], available: false });
    const items = [
      { visitor: 'Elliot', item: 'Anglepoise desk lamp', issue: 'The light flickers when the switch moves.', category: 'electrical', estimatedMinutes: 30, reviewRequired: false },
      { visitor: 'Nora', item: 'Favourite denim jacket', issue: 'A small tear near the left pocket.', category: 'textiles', estimatedMinutes: 20, reviewRequired: false },
      { visitor: 'Amir', item: 'Everyday city bicycle', issue: 'Rear brake rubs against the wheel.', category: 'bicycles', estimatedMinutes: 25, reviewRequired: false },
      { visitor: 'Grace', item: 'Kitchen stool', issue: 'A loose joint makes the seat wobble.', category: 'woodwork', estimatedMinutes: 40, reviewRequired: false },
      { visitor: 'Jules', item: 'Portable radio', issue: 'Battery compartment has visible residue. Review intake first.', category: 'electrical', estimatedMinutes: 30, reviewRequired: true },
      { visitor: 'Ada', item: 'Weekend backpack', issue: 'The zipper slider has broken.', category: 'textiles', estimatedMinutes: 15, reviewRequired: false },
      { visitor: 'Leo', item: 'Small table fan', issue: 'The control knob no longer engages.', category: 'electrical', estimatedMinutes: 25, reviewRequired: false },
    ];
    const tickets = items.map(i => this.addTicket(s.id, i));
    this.act(s.id, tickets[0].id, { action: 'assign', version: 1, volunteerId: maya.id });
    this.act(s.id, tickets[2].id, { action: 'assign', version: 1, volunteerId: theo.id });
    const robin = this.readSession(s.id).volunteers.find(v => v.name === 'Robin Chen')!;
    this.act(s.id, tickets[5].id, { action: 'assign', version: 1, volunteerId: robin.id });
    this.act(s.id, tickets[5].id, { action: 'complete', version: 2, outcome: 'repaired', note: 'Fitted a replacement slider. The zipper now closes smoothly.' });
    return s;
  }
}
