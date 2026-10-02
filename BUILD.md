# Build notes for agents

Tempo is a hybrid time-tracking demo. The browser owns an anonymous local workspace; bounded Vura Function-compatible endpoints validate entry drafts and generate reports. It is not a production multi-user SaaS backend until you add auth and durable tenant storage.

## Smooth path

```sh
npm install
npm run dev
npm test
npm run build
npm run smoke
```

Deploy after a Vura project is linked:

```sh
npx vura-platform projects --team <team-id>
npx vura-platform projects create what-starter-tempo --team <team-id>
npx vura-platform projects link <project-id>
npm run deploy
```

## State model

`src/state.js` is the main file to copy when building another app. It keeps app state in module-scope signals instead of component-local state:

```js
export const workspace = signal(loadWorkspace());
export const routePath = signal(window.location.pathname);
export const selectedProject = signal(workspace().projects[0]?.id || '');
export const serverReport = signal({ status: 'idle', data: null, error: null });
```

This makes sibling screens share the same workspace without context providers or a store package.

## Computed data

Derived totals live in pure domain code and are wrapped by `computed()` in `src/state.js`:

```js
export const summary = computed(() => summarizeWorkspace(workspace(), now()));
export const runningEntry = computed(() => {
  const running = workspace().running;
  return running ? workspace().entries.find((entry) => entry.id === running.entryId) || null : null;
});
```

The UI reads `summary()` and `runningEntry()` through function children, so timer state, totals and budget bars update without manual DOM coordination.

## Iteration note: seed dates and budget health

The first public capture showed an empty "Editable entries" list because fixture dates were hard-coded. `cloneSeed(now)` now derives fixture days from the active clock, so every visitor gets real current-day rows while tests can still pass an explicit timestamp.

Budget status is also computed in pure domain code:

```js
export function budgetStatus(minutes, budgetMinutes) {
  const used = minutes / budgetMinutes;
  if (used >= 1) return 'over';
  if (used >= 0.8) return 'watch';
  return 'healthy';
}
```

The starter fixtures intentionally show all three states. The UI renders a status chip plus an 80% tick on each budget bar, which makes the "slow down" promise visible without adding a backend or fake billing.

## Effects and browser storage

The demo persists only to the current browser:

```js
const disposePersist = effect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace()));
  } catch {}
});
```

`sanitizeWorkspace()` bounds recovered localStorage to 20 projects, 500 entries, short strings and valid dates before accepting it. Corrupted storage falls back to the seed workspace.

## Routing

Tempo uses a tiny route signal because the starter has three product screens:

```js
export function navigate(path) {
  if (window.location.pathname !== path) history.pushState({}, '', path);
  routePath(path);
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
}
```

`src/app.jsx` switches on `routePath()` and `scripts/build-vura.mjs` copies the Vite shell to `/timer`, `/projects` and `/report` so production deep links work. For dynamic nested apps, use `what-framework/router`.

## API boundary

The product UI calls two real endpoints:

- `POST /api/entry` validates and normalizes a draft before saving locally.
- `POST /api/report` validates the full workspace and returns typed totals.

Both endpoints export Worker-compatible `default.fetch(request)` objects and never import client views. Shared report math lives in `src/domain.js`.

```js
const response = await fetch('/api/report', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(workspace())
});
```

Every API response uses `cache-control: no-store` because reports are personalized to the visitor's local workspace.

## Bounded JSON reader

Earlier API drafts used `await request.text()` and checked `text.length`. That was wrong for two reasons: it buffered the whole body before enforcing the cap, and JavaScript string length is not UTF-8 byte length.

`src/api/bounded-json.js` now reads the stream chunk by chunk, counts `Uint8Array.byteLength`, cancels the reader when the byte cap is crossed, then decodes and parses only accepted bodies.

Before:

```js
const text = await request.text();
if (text.length > MAX_BODY_BYTES) throw tooLarge();
return JSON.parse(text || '{}');
```

After:

```js
const { done, value } = await reader.read();
const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
totalBytes += chunk.byteLength;
if (totalBytes > maxBytes) {
  await reader.cancel().catch(() => {});
  throw new JsonBodyError('Request body is too large.', 413);
}
```

Regression coverage proves multibyte emoji can trip the byte cap even when string length is small, streamed oversized bodies return 413 and cancel after the second chunk, and malformed JSON returns 400.

## Vura packaging

`npm run build` produces:

- `dist/static/**` — static/client pages and assets.
- `dist/functions/api_entry/index.js` and `dist/functions/api_report/index.js` — self-contained serverless bundles.
- `dist/manifest.json` — route manifest consumed by `vura-platform deploy`.

The functions are bundled with shared domain code so emitted files do not import missing source files.

The timer UI is still client-rendered after the shell loads, but the Vura manifest marks only the known shell URLs as `mode: "static"` with explicit `config.staticKey` values. Do not switch these page entries to `mode: "client"` unless you want a global SPA fallback: Vura's edge router serves extensionless unknown paths from `index.html` for client-mode deployments. Tempo instead publishes `/`, `/timer`, `/projects`, `/report` and `/build` explicitly, sets `notFoundPage: "404.html"`, and lets unknown paths return the generated 404 document.

The local preview server mirrors this static-delivery contract for smoke tests, but it is only a contract check. The provider retry is the proof for hosted HTTP status on unknown routes.

## Production backend extension

To turn this into a production SaaS backend:

1. Add authentication.
2. Add durable per-tenant storage.
3. Move entry writes from localStorage to a server-owned write path.
4. Keep the same validation/report shape, but bind records to the authenticated tenant.

Do not reuse Vura control-plane storage for app data, and do not describe this starter as multi-user persistence.
