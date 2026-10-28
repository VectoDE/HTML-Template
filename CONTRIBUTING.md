# Contributing

Thanks for helping. This project is an interactive reference for HTML, CSS and JavaScript. Corrections, new demos and fixes to the site are all welcome. Please read the [Code of Conduct](CODE_OF_CONDUCT.md) first.

Security problems do not go into public issues. See [SECURITY.md](SECURITY.md).

## Before you start

- For a question or an idea, start a [discussion](https://github.com/VectoDE/HTML-Template/discussions).
- For a bug, a wrong or outdated statement, or a demo you want to see, open an issue with the matching form.
- For anything larger than a small fix, comment on the issue first so the work is not duplicated or turned down after the fact.

## Setup

You need Node.js 24 or newer. The repository pins the version in `.nvmrc`.

```sh
nvm use
npm ci --ignore-scripts
npm test
npm run lint
```

`npm ci --ignore-scripts` installs exactly what the lockfile says and does not run dependency install scripts. Use it locally as well as in CI.

`npm run format` rewrites files with Prettier. `npm run lint` checks formatting and the repository policy checks without changing anything.

## Dependencies

Prettier is the only dev dependency in stage 1. It is the single formatter for Markdown, YAML, JSON, JavaScript and CSS, so the repository needs no per-language tooling. A new dev dependency needs a stated reason in the pull request, and the shipped site has no runtime dependencies. Do not add a package for something a few lines of code or a platform feature can do.

## Commits

Use [conventional commits](https://www.conventionalcommits.org/): `type: short summary`, for example `fix: correct the baseline status of :has()`. Common types are `feat`, `fix`, `docs`, `test`, `refactor`, `build` and `ci`. Use the imperative mood and keep the first line short. End the message with a reference to the issue it belongs to:

```text
docs: fix the browser support note for anchor positioning

Refs #123
```

### Sign-off

Every commit needs a `Signed-off-by` line, which certifies the [Developer Certificate of Origin](https://developercertificate.org/). Add it with `git commit -s`. The line must use the commit author's name and e-mail, so set `user.name` and `user.email` to the identity you commit under before you sign off. If you cherry-pick a commit or use `--author`, add the sign-off for the author of that commit yourself, for example by amending with `git commit --amend -s --author="Name <address>"`. The `dco` check on pull requests fails when a sign-off is missing or does not match the author.

Do not sign commits with `-S`. The sign-off line is what the project requires.

### Attribution

Commits, pull requests, issues and docs must not carry tool attribution trailers or footers. That covers any line that names a code generator or an assistant as author, co-author or origin. The policy check fails the build when it finds one.

## Pull requests

- Keep a pull request to one topic.
- Run `npm run lint` and `npm test` before you push. Both must exit 0.
- Fill in the pull request template.
- Content changes need a source: MDN, the specification or a browser release note.
- Write in plain English. Short, specific sentences are better than claims about how good a feature is.

## Writing a demo

Guidance on writing a demo (structure, metadata, what makes a demo worth including) will be written in the wiki page "Writing a demo" at <https://github.com/VectoDE/HTML-Template/wiki>. It is not available yet. Demo contributions open up once the demo format is final, so please check the wiki before starting one.

## License

By contributing you agree that your contribution is released under the [MIT License](LICENSE).
