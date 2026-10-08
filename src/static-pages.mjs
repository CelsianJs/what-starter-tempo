import { h } from 'what-framework';

export function BuildPage() {
  return h('main', { class: 'build' },
    h('nav', { 'aria-label': 'Starter navigation' }, h('a', { href: '/' }, 'Tempo'), h('a', { href: '/projects' }, 'Projects'), h('a', { href: '/report' }, 'Report')),
    h('p', { class: 'eyebrow' }, 'Agent reference'),
    h('h1', null, 'How Tempo is built'),
    h('section', null,
      h('h2', null, 'Pending entry, running block and persistence boundary'),
      h('p', null, 'A delayed validation could accept two timer starts and leave an orphan block. startTimer now guards pending/running state before validation, while controls expose checking state. The running block reads existing clock signals, keyed project options preserve selection, and denied persistence is labeled session-only. Browser tests delay validation and require one request and one new row.'),
      h('pre', null, "if (entryValidation().status === 'loading' || runningEntry()) return;")
    ),
    h('section', null,
      h('h2', null, 'Reset owns the new workspace'),
      h('p', null, 'Disabling a pending button is not enough: a response can arrive after Reset. A workspace generation and per-operation request counters decide whether each success or failure still owns its result. Reset invalidates both entry and report ownership, and a newer report cannot be overwritten by an older one. Controlled browser fetches exercise late success, validation failure, network failure, and out-of-order reports.'),
      h('pre', null, 'const ownsResponse = () => generation === workspaceGeneration && request === reportRequest;')
    ),
    h('p', null, 'Tempo is a public What Framework starter for a hybrid time-tracking demo. The product UI is a client app, this page is generated at build time, and /api/entry plus /api/report are Vura Function-compatible serverless endpoints.'),
    h('section', null,
      h('h2', null, 'State, computed values and effects'),
      h('ul', null,
        h('li', null, 'Signals: workspace, routePath, selectedProject, entryNote, serverReport and entryValidation live in src/state.js so every screen shares one anonymous workspace.'),
        h('li', null, 'Computed values: summary, runningEntry and todaysEntries derive from the workspace without mutating UI state.'),
        h('li', null, 'Effects: localStorage persistence is best-effort and bounded by sanitizeWorkspace before reuse.'),
        h('li', null, 'Routing: a small route signal plus copied static shells make /timer, /projects and /report production deep links work.')
      )
    ),
    h('section', null,
      h('h2', null, 'API boundary to copy'),
      h('p', null, 'POST /api/entry validates and normalizes an entry draft before it is saved in the browser. POST /api/report validates the local workspace and returns typed totals. Both return no-store JSON and never import client views.'),
      h('pre', null, "await fetch('/api/report', {\\n  method: 'POST',\\n  headers: { 'content-type': 'application/json' },\\n  body: JSON.stringify(workspace())\\n});")
    ),
    h('section', null,
      h('h2', null, 'Issue fixed during build'),
      h('p', null, 'The first API draft checked request.text().length. That buffered the full body and counted UTF-16 code units, not UTF-8 bytes. The current bounded reader counts Uint8Array.byteLength, cancels oversized streams, returns 413 for body limits and 400 for malformed JSON. Tests cover multibyte caps, stream cancellation and normal validation.')
    ),
    h('section', null,
      h('h2', null, 'Design iteration: dated fixtures and budget states'),
      h('p', null, 'A visual review caught that fixed seed dates could make the main editable list empty after the calendar moved on. The seed now derives entry days from an explicit clock, so tests are deterministic and visitors still see current-day rows.'),
      h('p', null, 'Project budget cards also expose healthy, watch and over states from pure domain math. The cards show a status chip and an 80% threshold tick so the budget warning behavior is visible in the starter instead of buried in copy.')
    ),
    h('section', null,
      h('h2', null, 'Design iteration: list identity while typing'),
      h('p', null, 'A browser audit found the editable entry rows were remounting the active input during continuous keyboard replacement. That dropped focus to the document body and only accepted the first typed character.'),
      h('p', null, 'The row list now uses keyed <For fallback> rendering, and EntryRow reads signal-wrapped entry accessors such as entry().note and entry().minutes. The regression test marks the active note and minutes DOM nodes, uses select-all/backspace/type, and proves the same node stays focused while the full value persists after reload.')
    ),
    h('section', null,
      h('h2', null, 'Boundaries'),
      h('p', null, 'No auth, database or shared tenant data is claimed. Every visitor receives an isolated localStorage workspace that can be reset. Add auth and durable tenant storage before calling it a production SaaS backend.'),
      h('p', null, 'Planned public source: https://github.com/CelsianJs/what-starter-tempo')
    )
  );
}

export function NotFoundPage() {
  return h('main', { class: 'build' },
    h('p', { class: 'eyebrow' }, '404'),
    h('h1', null, 'Tempo could not find that route.'),
    h('p', null, 'The deployed starter serves a real 404 document for unknown static paths.'),
    h('p', null, h('a', { href: '/' }, 'Return to the timer'))
  );
}

export const staticCss = `
  *{box-sizing:border-box}
  body{margin:0;background:#f7f8fa;color:#242a33;font:16px/1.6 'Avenir Next','Segoe UI Variable','Segoe UI',sans-serif}
  .build{width:min(840px,calc(100% - 32px));margin:0 auto;padding:32px 0}
  nav{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:32px}
  nav a{display:inline-flex;align-items:center;min-height:44px;padding:8px 16px;border:1px solid #d8dce1;border-radius:8px;background:white;font-size:14px;text-decoration:none}
  .eyebrow{color:#9b3512;font-size:14px;font-weight:600}
  h1{font-size:32px;line-height:1.2;letter-spacing:-.02em;margin:0 0 16px;font-weight:600}
  h2{font-size:24px;line-height:1.3;margin-top:32px;font-weight:600}
  pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#242a33;color:#fff;border-radius:8px;padding:16px;overflow:auto;font-size:14px;line-height:1.6}
  a{color:#9b3512} a:focus-visible{outline:2px solid #9b3512;outline-offset:3px} li{margin:8px 0}
  @media(max-width:600px){h1{font-size:28px}.build{padding:24px 0}}
`;
