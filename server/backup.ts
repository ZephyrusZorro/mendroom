import { z } from 'zod';
import { sessionInput, ticketInput, volunteerInput } from '../shared/model.ts';
import { MAX_ACTIVITIES, MAX_NOTES, MAX_TICKETS, MAX_VOLUNTEERS } from '../shared/limits.ts';
const id = z.string().uuid();
const timestamp = z.string().datetime();
const session = sessionInput.extend({ id, sample: z.boolean(), createdAt: timestamp });
const volunteer = volunteerInput.extend({
  id,
  sessionId: id,
  version: z.number().int().positive(),
});
const ticket = ticketInput.extend({
  id,
  sessionId: id,
  number: z.number().int().positive(),
  queueOrder: z.number().int().positive(),
  status: z.enum(['queued', 'in-progress', 'waiting-parts', 'repaired', 'unrepairable']),
  volunteerId: id.nullable(),
  notes: z.string().max(MAX_NOTES),
  partsNeeded: z.string().max(500),
  createdAt: timestamp,
  startedAt: timestamp.nullable(),
  finishedAt: timestamp.nullable(),
  version: z.number().int().positive(),
});
const activity = z
  .object({
    id,
    sessionId: id,
    ticketId: id.nullable(),
    message: z.string().min(1).max(2500),
    createdAt: timestamp,
  })
  .strict();
export const backupSchema = z
  .object({
    format: z.literal('mendroom'),
    version: z.literal(1),
    exportedAt: timestamp,
    session,
    volunteers: z.array(volunteer).max(MAX_VOLUNTEERS),
    tickets: z.array(ticket).max(MAX_TICKETS),
    activities: z.array(activity).max(MAX_ACTIVITIES),
  })
  .strict()
  .superRefine((value, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    const identities = new Set<string>([value.session.id]);
    for (const record of [...value.volunteers, ...value.tickets, ...value.activities]) {
      if (identities.has(record.id)) issue('Duplicate record identity');
      identities.add(record.id);
      if (record.sessionId !== value.session.id) issue('Invalid session reference');
    }
    const volunteerMap = new Map(value.volunteers.map((v) => [v.id, v]));
    const ticketIds = new Set(value.tickets.map((t) => t.id));
    const numbers = new Set<number>();
    const orders = new Set<number>();
    const active = new Set<string>();
    for (const t of value.tickets) {
      if (numbers.has(t.number) || orders.has(t.queueOrder))
        issue('Duplicate ticket number or queue position');
      numbers.add(t.number);
      orders.add(t.queueOrder);
      if (t.volunteerId && !volunteerMap.has(t.volunteerId)) issue('Invalid volunteer reference');
      if (t.status === 'in-progress') {
        if (!t.volunteerId || !t.startedAt || t.finishedAt || t.reviewRequired)
          issue('Invalid active repair state');
        if (t.volunteerId && active.has(t.volunteerId))
          issue('Multiple active repairs for one volunteer');
        if (t.volunteerId && !volunteerMap.get(t.volunteerId)?.skills.includes(t.category))
          issue('Active repair has no matching skill');
        if (t.volunteerId) active.add(t.volunteerId);
      }
      if (['queued', 'waiting-parts'].includes(t.status) && t.volunteerId)
        issue('Queued and parts tickets cannot hold a volunteer');
      if (
        ['repaired', 'unrepairable'].includes(t.status) &&
        (!t.finishedAt || !t.startedAt || !t.notes.trim())
      )
        issue('Completed repair requires dates and outcome notes');
      if (t.status === 'waiting-parts' && !t.partsNeeded.trim())
        issue('Parts follow-up requires a part description');
    }
    for (const a of value.activities)
      if (a.ticketId && !ticketIds.has(a.ticketId)) issue('Invalid activity ticket reference');
  });
export type Backup = z.infer<typeof backupSchema>;
