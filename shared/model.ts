import { z } from 'zod';

export const categories = ['electrical', 'textiles', 'bicycles', 'woodwork', 'general'] as const;
export type Category = (typeof categories)[number];
export const categoryLabels: Record<Category, string> = {
  electrical: 'Electrical',
  textiles: 'Textiles',
  bicycles: 'Bicycles',
  woodwork: 'Woodwork',
  general: 'General repair',
};
export const statuses = [
  'queued',
  'in-progress',
  'waiting-parts',
  'repaired',
  'unrepairable',
] as const;
export type Status = (typeof statuses)[number];
export const statusLabels: Record<Status, string> = {
  queued: 'In queue',
  'in-progress': 'At the bench',
  'waiting-parts': 'Needs parts',
  repaired: 'Repaired',
  unrepairable: 'Not repaired',
};
const text = (max: number) => z.string().trim().min(1).max(max);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Enter a real calendar date');
export const sessionInput = z
  .object({
    title: text(100),
    location: text(150),
    date,
    durationMinutes: z.number().int().min(30).max(720),
  })
  .strict();
export const volunteerInput = z
  .object({
    name: text(60),
    skills: z
      .array(z.enum(categories))
      .min(1)
      .max(5)
      .transform((a) => [...new Set(a)]),
    available: z.boolean().default(true),
  })
  .strict();
export const volunteerEdit = z
  .object({ version: z.number().int().positive(), available: z.boolean() })
  .strict();
export const ticketInput = z
  .object({
    visitor: text(60),
    item: text(100),
    issue: text(1200),
    category: z.enum(categories),
    estimatedMinutes: z.number().int().min(5).max(180),
    reviewRequired: z.boolean().default(false),
  })
  .strict();
const version = z.number().int().positive();
export const actionInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('assign'), version, volunteerId: z.string().uuid() }).strict(),
  z
    .object({
      action: z.literal('complete'),
      version,
      outcome: z.enum(['repaired', 'unrepairable']),
      note: text(2000),
    })
    .strict(),
  z
    .object({ action: z.literal('parts'), version, note: text(2000), partsNeeded: text(500) })
    .strict(),
  z.object({ action: z.literal('return'), version }).strict(),
  z.object({ action: z.literal('clear-review'), version, note: text(2000) }).strict(),
  z.object({ action: z.literal('note'), version, note: text(2000) }).strict(),
]);
export type Action = z.infer<typeof actionInput>;
export interface Session {
  id: string;
  title: string;
  location: string;
  date: string;
  durationMinutes: number;
  sample: boolean;
  createdAt: string;
}
export interface Volunteer {
  id: string;
  sessionId: string;
  name: string;
  skills: Category[];
  available: boolean;
  version: number;
}
export interface Ticket {
  id: string;
  sessionId: string;
  number: number;
  queueOrder: number;
  visitor: string;
  item: string;
  issue: string;
  category: Category;
  estimatedMinutes: number;
  reviewRequired: boolean;
  status: Status;
  volunteerId: string | null;
  notes: string;
  partsNeeded: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  version: number;
}
export interface Activity {
  id: string;
  sessionId: string;
  ticketId: string | null;
  message: string;
  createdAt: string;
}
export interface Forecast {
  ticketId: string;
  volunteerId: string | null;
  volunteerName: string | null;
  waitMinutes: number | null;
  finishMinutes: number | null;
  reason: string;
}
export interface SessionData {
  session: Session;
  volunteers: Volunteer[];
  tickets: Ticket[];
  activities: Activity[];
  forecast: Forecast[];
}
export interface SessionSummary extends Session {
  total: number;
  repaired: number;
  active: number;
}
