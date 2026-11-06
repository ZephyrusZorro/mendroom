import type { SessionData } from '../shared/model.ts';
function cell(value: string | number) {
  let text = String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/u.test(text)) text = `'${text.trimStart()}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export function sessionCsv(data: SessionData): string {
  const rows: (string | number)[][] = [['Ticket', 'Item', 'Visitor alias', 'Issue', 'Category', 'Status', 'Volunteer', 'Estimated minutes', 'Parts needed', 'Notes', 'Checked in', 'Completed']];
  for (const t of data.tickets) rows.push([t.number, t.item, t.visitor, t.issue, t.category, t.status, data.volunteers.find(v => v.id === t.volunteerId)?.name || '', t.estimatedMinutes, t.partsNeeded, t.notes, t.createdAt, t.finishedAt || '']);
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}
