import { request } from './api.ts';
import type { SessionData, SessionSummary } from '../shared/model.ts';

/** A remembered ID is a preference, never a prerequisite for opening the workspace. */
export async function loadWorkspace(rememberedId: string, baseUrl = '') {
  const sessions = await request<SessionSummary[]>(`${baseUrl}/api/sessions`);
  const selectedId = sessions.some((s) => s.id === rememberedId)
    ? rememberedId
    : sessions[0]?.id || '';
  const data = selectedId
    ? await request<SessionData>(`${baseUrl}/api/sessions/${selectedId}`)
    : null;
  return { sessions, selectedId, data };
}
