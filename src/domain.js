export const STORAGE_KEY = 'what-starter-tempo.workspace.v1';

export function seedWorkspace(now = Date.now()) {
  const day = (offset) => isoToday(new Date(now + offset * 86400000));
  return {
    workspaceId: 'demo-' + Math.random().toString(36).slice(2, 8),
    running: null,
    projects: [
      { id: 'atlas', name: 'Atlas onboarding', client: 'Northstar Labs', budgetHours: 8, accent: '#e85d1c' },
      { id: 'orchard', name: 'Orchard content sprint', client: 'Lumen Foods', budgetHours: 4, accent: '#bc7a24' },
      { id: 'forge', name: 'Forge UI polish', client: 'Copperline Studio', budgetHours: 3, accent: '#604434' }
    ],
    entries: [
      { id: 'e1', projectId: 'atlas', note: 'Mapped activation states', minutes: 95, day: day(-3) },
      { id: 'e2', projectId: 'orchard', note: 'Drafted launch article', minutes: 130, day: day(-2) },
      { id: 'e3', projectId: 'forge', note: 'Reduced settings friction', minutes: 80, day: day(-1) },
      { id: 'e4', projectId: 'atlas', note: 'Budget review with product', minutes: 120, day: day(0) },
      { id: 'e5', projectId: 'orchard', note: 'Publication QA pass', minutes: 75, day: day(0) },
      { id: 'e6', projectId: 'forge', note: 'Component spacing repairs', minutes: 155, day: day(0) }
    ]
  };
}

export function cloneSeed(now = Date.now()) {
  return JSON.parse(JSON.stringify(seedWorkspace(now)));
}

export function formatMinutes(minutes) {
  const rounded = Math.max(0, Math.round(minutes || 0));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function isoToday(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function weekStart(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

export function entryMinutesWithRunning(entry, running, now = Date.now()) {
  if (!running || running.entryId !== entry.id) return entry.minutes;
  return entry.minutes + Math.max(0, Math.floor((now - running.startedAt) / 60000));
}

export function budgetStatus(minutes, budgetMinutes) {
  if (!budgetMinutes) return 'healthy';
  const used = minutes / budgetMinutes;
  if (used >= 1) return 'over';
  if (used >= 0.8) return 'watch';
  return 'healthy';
}

export function summarizeWorkspace(workspace, now = Date.now()) {
  const projects = workspace.projects || [];
  const entries = workspace.entries || [];
  const running = workspace.running || null;
  const currentWeek = weekStart(new Date(now));
  const byProject = projects.map((project) => {
    const projectEntries = entries.filter((entry) => entry.projectId === project.id);
    const minutes = projectEntries.reduce((sum, entry) => sum + entryMinutesWithRunning(entry, running, now), 0);
    const weekMinutes = projectEntries
      .filter((entry) => entry.day >= currentWeek)
      .reduce((sum, entry) => sum + entryMinutesWithRunning(entry, running, now), 0);
    const budgetMinutes = project.budgetHours * 60;
    return {
      ...project,
      minutes,
      weekMinutes,
      budgetMinutes,
      budgetUsed: budgetMinutes ? Math.min(1.2, minutes / budgetMinutes) : 0,
      status: budgetStatus(minutes, budgetMinutes)
    };
  });
  const totalMinutes = byProject.reduce((sum, project) => sum + project.minutes, 0);
  const weekMinutes = byProject.reduce((sum, project) => sum + project.weekMinutes, 0);
  const billableValue = Math.round((totalMinutes / 60) * 145);
  return { byProject, totalMinutes, weekMinutes, billableValue, entryCount: entries.length };
}

export function validateReportPayload(input) {
  const errors = [];
  if (!input || typeof input !== 'object') errors.push('payload must be an object');
  const projects = Array.isArray(input?.projects) ? input.projects : [];
  const entries = Array.isArray(input?.entries) ? input.entries : [];
  if (projects.length > 20) errors.push('project count is capped at 20 for the public demo');
  if (entries.length > 500) errors.push('entry count is capped at 500 for the public demo');
  if (projects.length === 0) errors.push('at least one project is required');
  if (entries.length === 0) errors.push('at least one entry is required');
  const projectIds = new Set(projects.map((project) => project.id));
  for (const project of projects) {
    if (typeof project.id !== 'string' || project.id.length > 80 || typeof project.name !== 'string' || project.name.length > 120) errors.push('each project needs bounded id and name strings');
    if (!Number.isFinite(project.budgetHours) || project.budgetHours < 0) errors.push(`project ${project.id || 'unknown'} has an invalid budget`);
  }
  for (const entry of entries) {
    if (typeof entry.id !== 'string' || entry.id.length > 80) errors.push('each entry needs a bounded string id');
    if (typeof entry.note !== 'string' || entry.note.length > 120) errors.push(`entry ${entry.id || 'unknown'} note is too long`);
    if (!projectIds.has(entry.projectId)) errors.push(`entry ${entry.id || 'unknown'} references an unknown project`);
    if (!Number.isFinite(entry.minutes) || entry.minutes < 0 || entry.minutes > 1440) errors.push(`entry ${entry.id || 'unknown'} has invalid minutes`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.day || '')) errors.push(`entry ${entry.id || 'unknown'} needs YYYY-MM-DD day`);
  }
  return { ok: errors.length === 0, errors };
}
