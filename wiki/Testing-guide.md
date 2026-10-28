This page lists what is tested and with which tool. Only the unit tests and the policy checks exist today. The rest is added with the stage that builds the thing under test.

## Exists now

- Unit tests with the Node test runner, in `tests/unit`. Run them with `npm test`. They cover the policy checks, the release helpers and the wiki link check.
- Policy checks, run with `npm run policy`. They check the workflow files, line endings, forbidden text in commits and files, DCO sign-off and links between wiki pages.
- Formatting with Prettier, run with `npm run format:check`.
- CodeQL and the OpenSSF Scorecard run in GitHub Actions.

## Planned

| Area            | Tool                                       | Stage  |
| --------------- | ------------------------------------------ | ------ |
| Build           | `node:test`                                | 2      |
| Editor          | `node:test`, fake IndexedDB                | 3      |
| Shell and demos | Playwright in Chromium, Firefox and WebKit | 3 to 5 |
| Accessibility   | axe-core inside Playwright                 | 3      |
| Performance     | Lighthouse CI                              | 3      |
| Worker          | Vitest with the Workers pool or Miniflare  | 4      |
| Links           | Weekly link check                          | 4      |

## What the end-to-end tests check

- Navigation, the command palette and the theme switch work.
- The editor edits, copies, resets, shares and downloads.
- Every demo loads and runs without console errors or CSP violations, and shows its fallback where the API is unsupported.
- Permission demos never prompt on load.
- Demos marked `runsIn: window` open on the preview origin, and the in-frame view shows the fallback.
- Demos still work through their simulation when the Worker is blocked.
- No page scrolls horizontally at 375 px.

## Isolation tests

- Code in a preview can read neither the shell's IndexedDB nor its caches.
- The runner ignores messages from foreign origins.
- The shell's CSP blocks frames from any other origin.

## Worker tests

Echo, SSE and WebSocket behaviour, rate limiting, the CORS allow-list and the rule that nothing is stored. After each deploy a smoke test calls the live Worker.

See [[Accessibility guidelines]] for the accessibility checks and [[Security model]] for the boundaries the isolation tests protect.
