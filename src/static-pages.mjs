import { h } from 'what-framework';

export function BuildPage() {
  return h('main', { class: 'build' },
    h('p', { class: 'eyebrow' }, 'Agent reference'),
    h('h1', null, 'How Tempo is built'),
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
  body{margin:0;background:#f6ead5;color:#221711;font-family:Georgia,'Times New Roman',serif}
  .build{width:min(820px,calc(100% - 32px));margin:0 auto;padding:72px 0;line-height:1.65}
  .eyebrow{color:#9b3512;text-transform:uppercase;letter-spacing:.14em;font:800 12px ui-sans-serif,system-ui}
  h1{font-size:clamp(44px,9vw,92px);line-height:.9;letter-spacing:-.06em;margin:0 0 18px}
  h2{font-size:28px;margin-top:36px}
  pre{white-space:pre-wrap;background:#24160f;color:#ffe6c5;border-radius:18px;padding:16px;overflow:auto}
  a{color:#9b3512} li{margin:10px 0}
`;
