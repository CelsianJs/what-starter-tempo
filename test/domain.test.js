import { describe, expect, it } from 'vitest';
import { budgetStatus, cloneSeed, formatMinutes, isoToday, summarizeWorkspace, validateReportPayload } from '../src/domain.js';

describe('Tempo domain model', () => {
  it('summarizes project time and billable totals', () => {
    const summary = summarizeWorkspace(cloneSeed(), Date.UTC(2026, 9, 1));
    expect(summary.totalMinutes).toBeGreaterThan(300);
    expect(summary.byProject).toHaveLength(3);
    expect(summary.billableValue).toBeGreaterThan(800);
  });

  it('seeds editable entries relative to the supplied clock', () => {
    const clock = Date.UTC(2026, 9, 2, 15);
    const workspace = cloneSeed(clock);
    const today = isoToday(new Date(clock));

    expect(workspace.entries.some((entry) => entry.day === today)).toBe(true);
    expect(workspace.entries.map((entry) => entry.day)).toContain('2026-09-29');
  });

  it('exposes healthy, watch and over-budget states in the fixture', () => {
    const summary = summarizeWorkspace(cloneSeed(Date.UTC(2026, 9, 2)), Date.UTC(2026, 9, 2));
    expect(summary.byProject.map((project) => project.status)).toEqual(['healthy', 'watch', 'over']);
    expect(summary.byProject.map((project) => budgetStatus(project.minutes, project.budgetMinutes))).toEqual(['healthy', 'watch', 'over']);
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
