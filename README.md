# HTML-Template

[![CI](https://github.com/VectoDE/HTML-Template/actions/workflows/ci.yml/badge.svg)](https://github.com/VectoDE/HTML-Template/actions/workflows/ci.yml)
[![CodeQL](https://github.com/VectoDE/HTML-Template/actions/workflows/codeql.yml/badge.svg)](https://github.com/VectoDE/HTML-Template/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/VectoDE/HTML-Template/badge)](https://scorecard.dev/viewer/?uri=github.com/VectoDE/HTML-Template)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/16029/badge)](https://www.bestpractices.dev/projects/16029)
[![License: MIT](https://img.shields.io/github/license/VectoDE/HTML-Template)](LICENSE)

HTML-Template is becoming an interactive reference for web developers. You look up a feature of HTML, CSS or JavaScript and see it working live. You change the code in the browser, watch the result, and copy it into your own project. Each feature is shown in its modern form, with the parts real projects need: accessibility, error handling and fallbacks.

A topic page holds the explanation of a feature, its verified browser support, live demos with an editor, and code you can copy. The site is in English only.

## Status

The project is being rebuilt in seven stages. Stage 1 is under way: repository, CI, OpenSSF checks, the wiki and the release pipeline. There is no deployed site yet.

- [Roadmap](https://github.com/VectoDE/HTML-Template/wiki/Roadmap)
- [Project board](https://github.com/users/VectoDE/projects/12)

## Local setup

You need Node.js 24 (pinned in `.nvmrc`).

```sh
npm ci --ignore-scripts
npm test
npm run lint
```

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md) before you open a pull request. Commits need a sign-off (`git commit -s`). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md). Decisions and roles are described in [GOVERNANCE.md](GOVERNANCE.md). Report vulnerabilities privately, as [SECURITY.md](SECURITY.md) describes.

## License

[MIT](LICENSE)
