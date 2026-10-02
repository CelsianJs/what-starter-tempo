# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-10-02
- Primary product surfaces: timer dashboard with serverless entry validation, compact product nav, project budget view, serverless report view, static `/build` explainer.
- Evidence reviewed: What Framework starter conventions, Vura build-output shape, and the public starter requirements.

## Brand
- Personality: warm editorial operations tool; a calm invoice-room notebook with crisp SaaS controls.
- Trust signals: explicit anonymous local workspace, visible budget math, server report JSON, reset control.
- Avoid: fake login, fake team collaboration, claims of database persistence, generic purple gradients.

## Product goals
- Goals: demonstrate What signals/computed/effects/routing plus Vura Function validation/report endpoints in a realistic hybrid time-tracking starter.
- Non-goals: production billing, auth, multi-user sync, real client data.
- Success signals: timer flow calls entry validation, entries edit inline, budgets derive instantly, report endpoint validates data.

## Personas and jobs
- Primary personas: agents and developers copying What/Vura patterns; founders evaluating starter quality.
- User jobs: understand app shape, run it locally, inspect source boundaries, deploy to Vura.
- Key contexts of use: desktop demo, mobile demo, source reading, marketing gallery click-through.

## Information architecture
- Primary navigation: Timer, Projects, Report, Build notes.
- Core routes/screens: `/`, `/projects`, `/report`, `/build`, `/404`, `/api/entry`, `/api/report`.
- Content hierarchy: product first, then implementation proof.

## Design principles
- Editorial warmth: large serif headlines and paper texture make the app memorable.
- Truthful demo boundaries: every screen labels storage/runtime constraints honestly.
- Tradeoffs: manual route signal keeps the app portable and easy to read instead of hiding routing behind a large abstraction.

## Visual language
- Color: cream paper, dark ink, burnt orange action color.
- Typography: Georgia serif for brand/editorial tone, system sans for controls.
- Spacing/layout rhythm: wide calm panels, tighter persistent header, rounded capsules, high-density entry rows only where useful.
- Shape/radius/elevation: generous rounded panels with soft warm shadows.
- Motion: tiny hover lift only; reduced motion disables transitions.
- Imagery/iconography: no stock imagery; typographic logo mark.

## Components
- Existing components to reuse: none; standalone public starter.
- New/changed components: shell, nav link, timer controls, metric strip, keyed editable entry row, project budget card, report panel.
- Variants and states: idle/running timer, real today-empty state, report idle/loading/ready/error, healthy/watch/over-budget budgets.
- Token/component ownership: CSS variables in `src/styles.css`.

## Accessibility
- Target standard: WCAG AA practical baseline.
- Keyboard/focus behavior: native inputs/selects/buttons, visible focus rings.
- Contrast/readability: dark ink on cream and white text on orange.
- Screen-reader semantics: labeled inputs, main landmark, aria labels for summaries.
- Reduced motion and sensory considerations: `prefers-reduced-motion` removes animations.

## Responsive behavior
- Supported breakpoints/devices: desktop and narrow mobile.
- Layout adaptations: timer controls and entries collapse to one column; mobile metrics use a compact 2+1 grid; project cards remain readable with status chips.
- Touch/hover differences: large touch targets, hover is decorative only.

## Interaction states
- Loading: report panel says `Generating…`.
- Empty: today's editable list shows a resettable empty state if entries are edited away.
- Error: report panel prints server validation/network errors.
- Success: report JSON shows typed totals and project status.
- Disabled: not needed.
- Offline/slow network: local app remains usable; server report shows fetch error.

## Content voice
- Tone: crisp, transparent, slightly editorial.
- Terminology: workspace, entry, budget, Function endpoint.
- Microcopy rules: disclose demo limitations where a production app would need auth/database.

## Implementation constraints
- Framework/styling system: What Framework `0.13.10`, Vite, handwritten CSS.
- Design variable constraints: local CSS variables only.
- Performance constraints: no third-party services, no tracking, tiny local seed data.
- Compatibility constraints: browser localStorage; Vura Function-compatible endpoint.
- Test/screenshot expectations: unit tests, API tests, build, Playwright smoke where browser is available.

## Open questions
- [ ] Root confirms final public repo URL after publishing.

## Visual QA audit
- External reference: none supplied; design was evaluated against this document rather than a pixel target.
- Current judgment: warm editorial SaaS direction is intentional, header/nav now uses tighter vertical spacing, mobile controls remain native/keyboard-accessible, current-day seed rows populate the editable list, keyed row rendering preserves focus while note/minutes edits recalculate totals, project budget cards show healthy/watch/over states with an 80% tick, and reduced-motion is respected.
- Follow-up after deployment: capture desktop/mobile screenshots from the live Vura URL and compare against the product goals above before linking from the marketing gallery.
