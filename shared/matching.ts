import type { Forecast, Ticket, Volunteer } from './model.ts';

/** Deterministic indicative queue projection; not a booking or safety assessment. */
export function forecast(tickets: Ticket[], volunteers: Volunteer[], now = Date.now()): Forecast[] {
  const slots = volunteers.filter(v => v.available).map(v => {
    const current = tickets.find(t => t.status === 'in-progress' && t.volunteerId === v.id);
    // An overrun cannot imply an immediately free bench. Keep a five-minute buffer.
    const elapsed = current?.startedAt ? Math.max(0, Math.floor((now - Date.parse(current.startedAt)) / 60_000)) : 0;
    return { volunteer: v, load: current ? Math.max(5, current.estimatedMinutes - elapsed) : 0 };
  });
  return tickets.filter(t => t.status === 'queued').sort((a, b) => a.queueOrder - b.queueOrder).map(t => {
    const base = { ticketId: t.id, volunteerId: null, volunteerName: null, waitMinutes: null, finishMinutes: null };
    if (t.reviewRequired) return { ...base, reason: 'Coordinator review needed' };
    const matches = slots.filter(s => s.volunteer.skills.includes(t.category)).sort((a, b) => a.load - b.load || a.volunteer.name.localeCompare(b.volunteer.name));
    if (!matches.length) return { ...base, reason: 'No available volunteer with this skill' };
    const slot = matches[0];
    const waitMinutes = slot.load;
    slot.load += t.estimatedMinutes;
    return { ticketId: t.id, volunteerId: slot.volunteer.id, volunteerName: slot.volunteer.name, waitMinutes, finishMinutes: slot.load, reason: `Skill match · ${t.estimatedMinutes} min estimate` };
  });
}
