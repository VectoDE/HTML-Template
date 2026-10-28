# Contributing

This project is an interactive reference for HTML, CSS and JavaScript. Corrections and fixes to the site are welcome, and so are demo requests. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

Security problems do not go into public issues. See [SECURITY.md](SECURITY.md).

## Before you start

- For a question or an idea, start a [discussion](https://github.com/VectoDE/HTML-Template/discussions).
- For a bug, a wrong or outdated statement, or a demo you want to see, open an issue with the matching form.
- For anything larger than a small fix, comment on the issue first so the work is not duplicated or turned down after the fact.

## Setup

You need Node.js 24 or newer. The repository pins the version in `.nvmrc`, and `nvm use` picks it up.

```sh
nvm use
npm ci --ignore-scripts
npm test
npm run lint
```

nvm-windows ignores `.nvmrc`. With it, run `nvm install 24` and then `nvm use 24` instead of `nvm use`.

`npm ci --ignore-scripts` installs exactly what the lockfile says and does not run dependency install scripts. Use it locally as well as in CI.

`npm run format` rewrites files with Prettier. `npm run lint` checks formatting and the repository policy checks without changing anything.

## Dependencies

Prettier is currently the only dev dependency. It formats Markdown, YAML, JSON, JavaScript and CSS, so the repository needs no per-language tooling. A new dev dependency needs a stated reason in the pull request, and the shipped site has no runtime dependencies. Do not add a package for something a few lines of code or a platform feature can do.

## Commits

Use [conventional commits](https://www.conventionalcommits.org/): `type: short summary` or `type(scope): short summary`, for example `fix: correct the baseline status of :has()`. Common types are `feat`, `fix`, `perf`, `docs`, `test`, `refactor`, `build` and `ci`. Use the imperative mood and keep the first line short.

The type matters because the release notes are generated from the commits. `feat` goes under Features, `fix` and `perf` under Fixes, and every other type under Other. After 1.0.0 the type also decides the next version: `feat` raises the minor version, `fix` and `perf` the patch version. A breaking change is marked with `!` after the type, as in `feat!: drop the old URLs`, or with a `BREAKING CHANGE:` footer, and raises the major version. The [Release process](https://github.com/VectoDE/HTML-Template/wiki/Release-process) page has the details.

Pull requests are squash-merged, so the pull request title becomes the commit on `main`. Only that title reaches the release notes and the version bump, and the commit types inside the pull request are lost. Give the title a conventional type, for example `feat(release): derive the next version from stage issues`.

End the message with a reference to the issue it belongs to:

```text
docs: fix the browser support note for anchor positioning

Refs #123
```

### Sign-off

Every commit needs a `Signed-off-by` line, which certifies the [Developer Certificate of Origin](https://developercertificate.org/). Add it with `git commit -s`. The line must use the commit author's name and e-mail, so set `user.name` and `user.email` to the identity you commit under before you sign off. If you cherry-pick a commit or use `--author`, add the sign-off for the author of that commit yourself, for example by amending with `git commit --amend -s --author="Name <address>"`. The `dco` check on pull requests fails when a sign-off is missing or does not match the author.

### Attribution

Commits, pull requests, issues and docs must not carry tool attribution trailers or footers, meaning any line that names a code generator or an assistant as author, co-author or origin. `npm run policy` looks for such lines in every tracked file. The `dco` workflow looks for them in the commit messages, the title and the body of each pull request. Issues and comments are reviewed by hand.

## Pull requests

- Keep a pull request to one topic.
- Run `npm run lint` and `npm test` before you push. Both must exit 0.
- New functionality and bug fixes come with automated tests. A pull request that changes behaviour without tests is not merged. Tests live in `tests/unit`, and `npm run test:coverage` must stay at 80 percent or higher for lines, branches and functions.
- Fill in the pull request template.
- Content changes need a source: MDN, the specification or a browser release note.
- Write plain English: short, specific sentences, and no claims about how good a feature is.

## Governance

How decisions are made and how to become a maintainer is described in [GOVERNANCE.md](GOVERNANCE.md).

## Writing a demo

A wiki page, "Writing a demo", will cover structure, metadata and what makes a demo worth including: <https://github.com/VectoDE/HTML-Template/wiki/Writing-a-demo>. It does not exist yet, so please hold off on demo pull requests until it does. Demo requests are welcome as issues.

## License

By contributing you agree that your contribution is released under the [MIT License](LICENSE).
