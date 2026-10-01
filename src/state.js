import { computed, effect, signal } from 'what-framework';
import { cloneSeed, entryMinutesWithRunning, isoToday, STORAGE_KEY, summarizeWorkspace, validateReportPayload } from './domain.js';

function loadWorkspace() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? sanitizeWorkspace(JSON.parse(saved)) : cloneSeed();
  } catch { return cloneSeed(); }
}

function sanitizeWorkspace(value) {
  const fallback = cloneSeed();
  if (!value || typeof value !== 'object') return fallback;
  const candidate = {
    workspaceId: typeof value.workspaceId === 'string' && value.workspaceId.length < 80 ? value.workspaceId : fallback.workspaceId,
    running: value.running && typeof value.running.entryId === 'string' && Number.isFinite(value.running.startedAt) ? value.running : null,
    projects: Array.isArray(value.projects) ? value.projects.slice(0, 20).map((project, index) => ({
      id: typeof project.id === 'string' ? project.id.slice(0, 80) : `project-${index}`,
      name: typeof project.name === 'string' ? project.name.slice(0, 120) : `Project ${index + 1}`,
      client: typeof project.client === 'string' ? project.client.slice(0, 120) : 'Demo client',
      budgetHours: Number.isFinite(Number(project.budgetHours)) ? Math.max(0, Math.min(10000, Number(project.budgetHours))) : 0,
      accent: typeof project.accent === 'string' && /^#[0-9a-f]{6}$/i.test(project.accent) ? project.accent : '#e85d1c'
    })) : fallback.projects,
    entries: Array.isArray(value.entries) ? value.entries.slice(0, 500).map((entry, index) => ({
      id: typeof entry.id === 'string' ? entry.id.slice(0, 80) : `entry-${index}`,
      projectId: typeof entry.projectId === 'string' ? entry.projectId.slice(0, 80) : '',
      note: typeof entry.note === 'string' ? entry.note.slice(0, 120) : 'Recovered entry',
      minutes: Number.isFinite(Number(entry.minutes)) ? Math.max(0, Math.min(1440, Math.round(Number(entry.minutes)))) : 0,
      day: /^\d{4}-\d{2}-\d{2}$/.test(entry.day || '') ? entry.day : isoToday()
    })) : fallback.entries
  };
  return validateReportPayload(candidate).ok ? candidate : fallback;
}

export const workspace = signal(loadWorkspace());
export const routePath = signal(window.location.pathname);
export const now = signal(Date.now());
export const draftMinutes = signal(45);
export const selectedProject = signal(workspace().projects[0]?.id || '');
export const entryNote = signal('Deep work block');
export const serverReport = signal({ status: 'idle', data: null, error: null });
export const entryValidation = signal({ status: 'idle', error: null });

const interval = setInterval(() => now(Date.now()), 15000);

const disposePersist = effect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace()));
  } catch {
    // Demo persistence is best-effort and intentionally browser-local.
  }
});

const onPopState = () => routePath(window.location.pathname);
window.addEventListener('popstate', onPopState);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(interval);
    disposePersist();
    window.removeEventListener('popstate', onPopState);
  });
}

export function navigate(path) {
  if (window.location.pathname !== path) {
    history.pushState({}, '', path);
  }
  routePath(path);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}

export const summary = computed(() => summarizeWorkspace(workspace(), now()));
export const currentProject = computed(() => workspace().projects.find((project) => project.id === selectedProject()) || workspace().projects[0]);
export const runningEntry = computed(() => {
  const running = workspace().running;
  if (!running) return null;
  return workspace().entries.find((entry) => entry.id === running.entryId) || null;
});
export const todaysEntries = computed(() => workspace().entries.filter((entry) => entry.day === isoToday()));

async function validateDraftEntry(entry) {
  entryValidation({ status: 'loading', error: null });
  try {
    const response = await fetch('/api/entry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ projects: workspace().projects, entry })
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      entryValidation({ status: 'error', error: data.errors?.join(' ') || data.error || 'Entry validation failed.' });
      return null;
    }
    entryValidation({ status: 'ready', error: null });
    return data.entry;
  } catch (error) {
    entryValidation({ status: 'error', error: error.message });
    return null;
  }
}

export async function startTimer() {
  const project = currentProject();
  if (!project) return;
  const draft = {
    id: 'e' + Math.random().toString(36).slice(2, 9),
    projectId: project.id,
    note: entryNote().trim() || 'Untitled work block',
    minutes: 0,
    day: isoToday()
  };
  const entry = await validateDraftEntry(draft);
  if (!entry) return;
  workspace((state) => ({
    ...state,
    running: { entryId: entry.id, startedAt: Date.now() },
    entries: [entry, ...state.entries]
  }));
}

export function stopTimer() {
  const state = workspace();
  if (!state.running) return;
  workspace({
    ...state,
    running: null,
    entries: state.entries.map((entry) => entry.id === state.running.entryId
      ? { ...entry, minutes: entryMinutesWithRunning(entry, state.running, Date.now()) }
      : entry)
  });
}

export async function addManualEntry() {
  const project = currentProject();
  const minutes = Math.max(1, Math.min(1440, Number(draftMinutes()) || 0));
  if (!project) return;
  const entry = await validateDraftEntry({
    id: 'e' + Math.random().toString(36).slice(2, 9),
    projectId: project.id,
    note: entryNote().trim() || 'Manual entry',
    minutes,
    day: isoToday()
  });
  if (!entry) return;
  workspace((state) => ({
    ...state,
    entries: [entry, ...state.entries]
  }));
}

export function updateEntry(id, patch) {
  workspace((state) => ({
    ...state,
    entries: state.entries.map((entry) => entry.id === id ? { ...entry, ...patch } : entry)
  }));
}

export function resetDemo() {
  workspace(cloneSeed());
  serverReport({ status: 'idle', data: null, error: null });
  entryValidation({ status: 'idle', error: null });
}

export async function requestServerReport() {
  serverReport({ status: 'loading', data: null, error: null });
  try {
    const response = await fetch('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(workspace())
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
      serverReport({ status: 'error', data, error: data.error || data.errors?.join(', ') || 'Report failed' });
      return;
    }
    serverReport({ status: 'ready', data, error: null });
  } catch (error) {
    serverReport({ status: 'error', data: null, error: error.message });
  }
}
