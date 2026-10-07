import { For, mount } from 'what-framework';
import './styles.css';
import {
  addManualEntry,
  draftMinutes,
  entryNote,
  entryValidation,
  navigate,
  now,
  persistenceStatus,
  requestServerReport,
  resetDemo,
  routePath,
  runningEntry,
  selectedProject,
  serverReport,
  startTimer,
  stopTimer,
  summary,
  todaysEntries,
  updateEntry,
  workspace
} from './state.js';
import { formatMinutes } from './domain.js';

function NavLink({ href, children }) {
  return (
    <button class={() => routePath() === href ? 'nav-link active' : 'nav-link'} onClick={() => navigate(href)}>
      {children}
    </button>
  );
}

function Shell({ children }) {
  return (
    <div class="shell">
      <header class="topbar">
        <button class="brand" onClick={() => navigate('/')}>
          <span class="brand-mark">t</span>
          <span><strong>Tempo</strong><small>What starter</small></span>
        </button>
        <nav aria-label="Primary">
          <NavLink href="/">Timer</NavLink>
          <NavLink href="/projects">Projects</NavLink>
          <NavLink href="/report">Report</NavLink>
          <a class="nav-link" href="/build">Build notes</a>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

function TimerPage() {
  return (
    <Shell>
      <section class="hero">
        <p class="eyebrow" role="status">Demo workspace · {() => persistenceStatus()}</p>
        <h1>Make room for your best work.</h1>
        <p class="hero-copy">Start a timer, add a work block, and watch project budgets stay honest. No signup is needed for this public demo.</p>
      </section>
      <section class="panel timer-panel" aria-label="Timer controls">
        <div>
          <label class="label" for="project">Project</label>
          <select id="project" value={() => selectedProject()} onChange={(event) => selectedProject(event.target.value)}>
            <For each={() => workspace().projects} key={(project) => project.id}>{(project) => <option value={project().id}>{project().name}</option>}</For>
          </select>
        </div>
        <div>
          <label class="label" for="note">Work note</label>
          <input id="note" value={() => entryNote()} onInput={(event) => entryNote(event.target.value)} />
        </div>
        <div>
          <label class="label" for="minutes">Manual minutes</label>
          <input id="minutes" type="number" min="1" max="1440" value={() => draftMinutes()} onInput={(event) => draftMinutes(event.target.value)} />
        </div>
        <div class="timer-actions">
          {() => runningEntry()
            ? <button class="button primary" onClick={stopTimer}>Stop timer</button>
            : <button class="button primary" disabled={() => entryValidation().status === 'loading'} onClick={startTimer}>{() => entryValidation().status === 'loading' ? 'Checking entry…' : 'Start timer'}</button>}
          <button class="button" disabled={() => entryValidation().status === 'loading'} onClick={addManualEntry}>Add block</button>
        </div>
        {() => runningEntry() ? <div class="running-block" role="status"><strong>Timer running · {Math.floor(Math.max(0, now() - (workspace().running?.startedAt || now())) / 60000)}m elapsed</strong><span>{runningEntry()?.note} · {workspace().projects.find((project) => project.id === runningEntry()?.projectId)?.name}</span></div> : null}
        <p role="status" class={() => entryValidation().status === 'error' ? 'validation error' : 'validation'}>
          {() => entryValidation().status === 'loading'
            ? 'Checking this entry…'
            : entryValidation().status === 'error'
              ? entryValidation().error
              : 'New entries are checked before they are saved to this browser.'}
        </p>
      </section>
      <MetricStrip />
      <section class="panel">
        <div class="section-heading">
          <p class="eyebrow">Today</p>
          <h2>Editable entries</h2>
        </div>
        <div class="entries">
          <For each={() => todaysEntries()} key={(entry) => entry.id} fallback={<EmptyEntries />}>
            {(entry) => <EntryRow entry={entry} />}
          </For>
        </div>
      </section>
    </Shell>
  );
}

function EmptyEntries() {
  return (
    <div class="empty-state">
      <strong>No blocks tracked today.</strong>
      <span>Start the timer or add a 45-minute block to repopulate the editable list.</span>
      <button class="button" onClick={resetDemo}>Restore demo entries</button>
    </div>
  );
}

function EntryRow({ entry }) {
  const project = () => workspace().projects.find((item) => item.id === entry().projectId);
  return (
    <article class="entry-row">
      <span class="dot" style={() => `--dot:${project()?.accent || '#e85d1c'}`}></span>
      <input aria-label="Entry note" value={entry().note} onInput={(event) => updateEntry(entry().id, { note: event.target.value })} />
      <select aria-label="Entry project" value={entry().projectId} onChange={(event) => updateEntry(entry().id, { projectId: event.target.value })}>
        {workspace().projects.map((item) => <option value={item.id}>{item.name}</option>)}
      </select>
      <input aria-label="Entry minutes" type="number" min="0" max="1440" value={entry().minutes} onInput={(event) => updateEntry(entry().id, { minutes: Number(event.target.value) || 0 })} />
    </article>
  );
}

function MetricStrip() {
  return (
    <section class="metrics" aria-label="Summary">
      <div><span>{() => formatMinutes(summary().totalMinutes)}</span><small>Total tracked</small></div>
      <div><span>{() => formatMinutes(summary().weekMinutes)}</span><small>This week</small></div>
      <div><span>{() => '$' + summary().billableValue.toLocaleString()}</span><small>Demo billable value</small></div>
    </section>
  );
}

function ProjectsPage() {
  const statusCopy = {
    healthy: ['Healthy', 'Pacing under budget'],
    watch: ['Watch', 'Above 80% of budget'],
    over: ['Over', 'Budget exceeded']
  };
  return (
    <Shell>
      <div class="section-heading compact-heading">
        <p class="eyebrow">Budgets</p>
        <h1>Project budgets that tell you when to slow down.</h1>
      </div>
      <div class="project-grid">
        {() => summary().byProject.map((project) => (
          <article class="project-card" data-status={project.status}>
            <span class="project-accent" style={`background:${project.accent}`}></span>
            <div class="project-title">
              <div>
                <h2>{project.name}</h2>
                <p>{project.client}</p>
              </div>
              <span class="status-chip">{statusCopy[project.status][0]}</span>
            </div>
            <strong>{formatMinutes(project.minutes)} / {project.budgetHours}h</strong>
            <div class="bar budget-bar" aria-label={`${statusCopy[project.status][1]} for ${project.name}`}>
              <span style={`width:${Math.min(100, project.budgetUsed * 100)}%; background:${project.accent}`}></span>
            </div>
            <p class="budget-note">{statusCopy[project.status][1]} · 80% tick shown</p>
          </article>
        ))}
      </div>
    </Shell>
  );
}

function ReportPage() {
  return (
    <Shell>
      <div class="section-heading">
        <p class="eyebrow">Weekly report</p>
        <h1>A clean read on time, budget and billable value.</h1>
      </div>
      <section class="panel report">
        <button class="button primary" onClick={requestServerReport}>Generate weekly report</button>
        <button class="button" onClick={resetDemo}>Reset demo data</button>
        <ReportResult />
      </section>
    </Shell>
  );
}

function ReportResult() {
  return () => {
    const report = serverReport();
    if (report.status === 'idle') return <p class="report-note">Generate a report when you want a server-checked weekly snapshot.</p>;
    if (report.status === 'loading') return <p class="report-note">Preparing your report…</p>;
    if (report.status === 'error') return <p class="report-note error">Report error: {report.error}</p>;
    return (
      <div class="report-result">
        <div class="report-total"><span>{formatMinutes(report.data.totals.minutes)}</span><small>Total time</small></div>
        <div class="report-total"><span>{formatMinutes(report.data.totals.weekMinutes)}</span><small>This week</small></div>
        <div class="report-total"><span>${report.data.totals.billableValue.toLocaleString()}</span><small>Billable value</small></div>
        <div class="report-projects">
          {report.data.projects.map((project) => (
            <article>
              <strong>{project.name}</strong>
              <span>{formatMinutes(project.minutes)} · {project.status}</span>
            </article>
          ))}
        </div>
        <details>
          <summary>Developer JSON</summary>
          <pre>{JSON.stringify(report.data, null, 2)}</pre>
        </details>
      </div>
    );
  };
}

function NotFoundPage() {
  return (
    <Shell>
      <section class="hero">
        <p class="eyebrow">404</p>
        <h1>This route is not part of the Tempo demo.</h1>
        <button class="button primary" onClick={() => navigate('/')}>Return to timer</button>
      </section>
    </Shell>
  );
}

function App() {
  return () => {
    const path = routePath().replace(/\/$/, '') || '/';
    if (path === '/' || path === '/timer') return <TimerPage />;
    if (path === '/projects') return <ProjectsPage />;
    if (path === '/report') return <ReportPage />;
    return <NotFoundPage />;
  };
}

mount(<App />, '#app');
