This page covers running the repository on your machine: the checks, the tests, the build and the coverage check. The build writes plain files to `dist/site`. There is no shell or dev server yet, so nothing is served in a browser.

## Requirements

- Node.js 24 or newer. The version is pinned in `.nvmrc`, so `nvm use` picks the right one. nvm-windows ignores `.nvmrc`; with it, run `nvm install 24` and then `nvm use 24`.
- Git. Commits must carry a `Signed-off-by` line (`git commit -s`).

## Set up

```sh
git clone https://github.com/VectoDE/HTML-Template.git
cd HTML-Template
nvm use
npm ci --ignore-scripts
```

`npm ci --ignore-scripts` installs exactly what the lockfile lists and skips the install scripts of dependencies. Use it locally and in CI. There are five dev dependencies. Prettier formats the files. ESLint and `@eslint/js` lint the JavaScript. `@mdn/browser-compat-data` and `web-features` are the data the build turns into support tables and the coverage check. The site itself has no runtime dependencies.

## Commands

| Command                   | What it does                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `npm test`                | Runs the unit tests in `tests/unit` with the Node test runner.                      |
| `npm run test:coverage`   | Runs the same tests and fails below 80 percent lines, branches or functions.        |
| `npm run build`           | Builds the static site into `dist/site`. Does not run the coverage check.           |
| `npm run coverage`        | Checks that every compat unit is covered, excluded or pending, and the claims lock. |
| `npm run coverage:update` | Rewrites `pending.json` and `claims.json` in `content/coverage` from the data.      |
| `npm run format`          | Rewrites files with Prettier.                                                       |
| `npm run format:check`    | Fails if a file is not formatted.                                                   |
| `npm run lint:js`         | Runs ESLint on the JavaScript with no warnings allowed.                             |
| `npm run policy`          | Checks workflows, line endings, forbidden text in tracked files and wiki links.     |
| `npm run lint`            | Runs `format:check`, `lint:js` and `policy`.                                        |

Run `npm test` and `npm run lint` before you push. Both must exit with 0. The build and the coverage check run in CI as well, in the job `build`. Run them yourself when you change anything under `content/` or `scripts/build/`. [[Topic catalogue and coverage]] explains the coverage check.

## What comes later

Stage 3 adds the shell and the editor, so the output of `npm run build` gets its styling and scripts. Stage 4 adds the preview runner and the demo Worker, which need their own local setup. This page will describe each of them when it lands. See the [[Roadmap]] for the order and the [[Testing guide]] for the test tools.

For the layout of the repository, read [[Architecture]].
