import { describe, expect, it } from 'vitest';
import { readBoundedJson } from '../src/api/bounded-json.js';
import entryWorker, { validateEntryPayload } from '../src/api/entry.js';
import reportWorker, { analyzeTempoPayload } from '../src/api/report.js';
import { cloneSeed } from '../src/domain.js';

function oversizedStream(chunks) {
  let reads = 0;
  let cancelled = false;

  const stream = new ReadableStream({
    pull(controller) {
      const chunk = chunks[reads];
      reads += 1;
      if (chunk) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
    cancel() {
      cancelled = true;
    }
  });

  return {
    stream,
    stats: () => ({ reads, cancelled })
  };
}

describe('Tempo serverless report', () => {
  it('returns typed totals for a valid workspace', async () => {
    const report = await analyzeTempoPayload(cloneSeed(), Date.UTC(2026, 9, 1));
    expect(report.ok).toBe(true);
    expect(report.totals.minutes).toBeGreaterThan(300);
    expect(report.projects[0]).toHaveProperty('status');
  });

  it('responds with 422 for invalid JSON shape', async () => {
    const response = await reportWorker.fetch(new Request('http://local/api/report', {
      method: 'POST',
      body: JSON.stringify({ projects: [], entries: [] })
    }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ ok: false });
  });

  it('counts UTF-8 bytes instead of JavaScript string length', async () => {
    const body = JSON.stringify({ note: '😀😀' });
    expect(body.length).toBeLessThan(18);
    await expect(readBoundedJson(new Request('http://local/api/report', {
      method: 'POST',
      body
    }), 17)).rejects.toMatchObject({ status: 413 });
  });

  it('returns 413 and cancels oversized streamed entry bodies', async () => {
    const encoder = new TextEncoder();
    const { stream, stats } = oversizedStream([
      encoder.encode('{"note":"'),
      new Uint8Array(17_000).fill(65),
      encoder.encode('"}')
    ]);
    const response = await entryWorker.fetch(new Request('http://local/api/entry', {
      method: 'POST',
      body: stream,
      duplex: 'half'
    }));

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ ok: false, error: 'Request body is too large.' });
    expect(stats()).toMatchObject({ reads: 2, cancelled: true });
  });

  it('returns 400 for malformed entry JSON', async () => {
    const response = await entryWorker.fetch(new Request('http://local/api/entry', {
      method: 'POST',
      body: '{"entry":'
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'Request body must be valid JSON.' });
  });

  it('normalizes entry drafts through the entry validation function', async () => {
    const workspace = cloneSeed();
    const result = validateEntryPayload({
      projects: workspace.projects,
      entry: { projectId: workspace.projects[0].id, note: '  Write report  ', minutes: 44.6, day: '2026-10-01' }
    });
    expect(result).toMatchObject({ ok: true, entry: { note: 'Write report', minutes: 45 } });
  });

  it('rejects invalid entry drafts through the Worker entry', async () => {
    const response = await entryWorker.fetch(new Request('http://local/api/entry', {
      method: 'POST',
      body: JSON.stringify({ projects: [], entry: { projectId: 'x', note: '', minutes: -1 } })
    }));
    expect(response.status).toBe(422);
  });
});
