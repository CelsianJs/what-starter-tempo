import { describe, expect, it } from 'vitest';
import { cloneSeed, formatMinutes, summarizeWorkspace, validateReportPayload } from '../src/domain.js';

describe('Tempo domain model', () => {
  it('summarizes project time and billable totals', () => {
    const summary = summarizeWorkspace(cloneSeed(), Date.UTC(2026, 9, 1));
    expect(summary.totalMinutes).toBeGreaterThan(300);
    expect(summary.byProject).toHaveLength(3);
    expect(summary.billableValue).toBeGreaterThan(800);
  });

  it('validates entries against known projects', () => {
    const workspace = cloneSeed();
    workspace.entries[0].projectId = 'missing';
    expect(validateReportPayload(workspace).ok).toBe(false);
  });

  it('formats minutes for human reports', () => {
    expect(formatMinutes(95)).toBe('1h 35m');
    expect(formatMinutes(12)).toBe('12m');
  });
});
