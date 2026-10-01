import { summarizeWorkspace, validateReportPayload } from '../domain.js';
import { readBoundedJson } from './bounded-json.js';

const MAX_BODY_BYTES = 96_000;

function json(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function analyzeTempoPayload(payload, now = Date.now()) {
  const validation = validateReportPayload(payload);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }
  const summary = summarizeWorkspace(payload, now);
  return {
    ok: true,
    generatedAt: new Date(now).toISOString(),
    totals: {
      minutes: summary.totalMinutes,
      weekMinutes: summary.weekMinutes,
      billableValue: summary.billableValue,
      entries: summary.entryCount
    },
    projects: summary.byProject.map((project) => ({
      id: project.id,
      name: project.name,
      client: project.client,
      minutes: project.minutes,
      weekMinutes: project.weekMinutes,
      budgetHours: project.budgetHours,
      budgetUsed: Number(project.budgetUsed.toFixed(3)),
      status: project.budgetUsed > 1 ? 'over-budget' : project.budgetUsed > 0.8 ? 'watch' : 'healthy'
    }))
  };
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'POST a workspace payload to generate a report.' }, 405);
    }
    try {
      const payload = await readBoundedJson(request, MAX_BODY_BYTES);
      const report = await analyzeTempoPayload(payload);
      return json(report, report.ok ? 200 : 422);
    } catch (error) {
      return json({ ok: false, error: error.status === 413 ? error.message : 'Request body must be valid JSON.' }, error.status || 400);
    }
  }
};
