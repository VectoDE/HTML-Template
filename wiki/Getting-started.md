This page covers running the repository on your machine. At the moment that means the checks and tests. The site build arrives in stage 2, so there is nothing to serve in a browser yet.

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

`npm ci --ignore-scripts` installs exactly what the lockfile lists and skips the install scripts of dependencies. Use it locally and in CI. Prettier is the only dev dependency right now.

## Commands

| Command                | What it does                                                                    |
| ---------------------- | ------------------------------------------------------------------------------- |
| `npm test`             | Runs the unit tests in `tests/unit` with the Node test runner.                  |
| `npm run format`       | Rewrites files with Prettier.                                                   |
| `npm run format:check` | Fails if a file is not formatted.                                               |
| `npm run policy`       | Checks workflows, line endings, forbidden text in tracked files and wiki links. |
| `npm run lint`         | Runs `format:check` and `policy`.                                               |

Run `npm test` and `npm run lint` before you push. Both must exit with 0.

## What comes later

Stage 2 adds the build script, so `npm run build` will produce the static site in `dist/`. Stage 3 adds the shell and the editor. Stage 4 adds the preview runner and the demo Worker, which need their own local setup. This page will describe each of them when it lands. See the [[Roadmap]] for the order and the [[Testing guide]] for the test tools.

For the layout of the repository, read [[Architecture]].
