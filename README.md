# Tempo — What Framework starter

Tempo is a public starter for a hybrid time-tracking demo built with What Framework and packaged for Vura. It uses real bounded serverless validation/report routes, but it is not a production multi-user SaaS backend until you add auth and durable storage.

It demonstrates:

- signal-driven global state;
- computed budget and weekly summaries;
- effects for browser-local persistence;
- route-driven product screens;
- generated static `/build` documentation;
- real serverless `/api/entry` validation and `/api/report` Function-compatible endpoints.

## Run locally

```sh
npm install
npx playwright install chromium
npm run dev
```

## Build and test

```sh
npm run build
npm test
npm run smoke
```

`npm run smoke` starts `dist/` locally, runs a real browser through timer/report/build/404 flows, and fails on relevant console warnings or errors.
On minimal Linux CI images that do not already include browser system libraries, use `npx playwright install --with-deps chromium` instead.

## Reset demo data

Use the **Reset demo data** button on `/report`, or clear `what-starter-tempo.workspace.v1` from localStorage. The timer/manual-entry flow posts draft entry data to `/api/entry` for validation before saving locally. **Generate weekly report** posts the anonymous workspace JSON to `/api/report`.

## Deploy to Vura

Root/publishing agent links the final project first:

```sh
npx vura-platform projects --team <team-id>
npx vura-platform projects create what-starter-tempo --team <team-id>
npx vura-platform projects link <project-id>
npm run deploy
# or
npm run deploy:prod
```

`vura-platform@0.3.0` is installed as a dev dependency, so `npm run deploy` uses the local CLI from `node_modules/.bin`. The deployment upload contains `dist/static`, `dist/functions/api_entry/index.js`, `dist/functions/api_report/index.js`, and `dist/manifest.json`. Vura serves static assets from its edge/R2 path and places Function routes according to the platform runtime map; do not describe the whole runtime as “all Workers.”

## Public source

Planned repository: `https://github.com/CelsianJs/what-starter-tempo`
