import { isoToday } from '../domain.js';
import { readBoundedJson } from './bounded-json.js';

const MAX_BODY_BYTES = 16_384;
const MAX_PROJECTS = 20;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export function validateEntryPayload(payload) {
  const errors = [];
  const projects = Array.isArray(payload?.projects) ? payload.projects.slice(0, MAX_PROJECTS) : [];
  const projectIds = new Set(projects.map((project) => typeof project?.id === 'string' ? project.id : '').filter(Boolean));
  const projectId = String(payload?.entry?.projectId || '').slice(0, 80);
  const note = String(payload?.entry?.note || '').trim().slice(0, 120);
  const minutes = Number(payload?.entry?.minutes || 0);
  const day = String(payload?.entry?.day || isoToday()).slice(0, 10);

  if (!projectIds.has(projectId)) errors.push('Choose a known project before creating time.');
  if (note.length < 3) errors.push('Write a note with at least 3 characters.');
  if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) errors.push('Minutes must be between 0 and 1440.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) errors.push('Entry day must be YYYY-MM-DD.');

  return {
    ok: errors.length === 0,
    errors,
    entry: {
      id: typeof payload?.entry?.id === 'string' && payload.entry.id.length <= 80
        ? payload.entry.id
        : 'server-' + Math.random().toString(36).slice(2, 9),
      projectId,
      note,
      minutes: Math.round(minutes),
      day
    }
  };
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'POST a draft entry and project list for validation.' }, 405);
    }
    try {
      const result = validateEntryPayload(await readBoundedJson(request, MAX_BODY_BYTES));
      if (!result.ok) return json(result, 422);
      return json({ ...result, checkedAt: new Date().toISOString() });
    } catch (error) {
      return json({ ok: false, error: error.status === 413 ? error.message : 'Request body must be valid JSON.' }, error.status || 400);
    }
  }
};
