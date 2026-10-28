The rebuild runs in seven stages. Each stage ends with a signed pre-release. Once the deployment pipeline exists (stage 4), the site is deployed after every stage. Stage 1 is in progress. The rest is planned, and the boundaries can still move.

| Stage | Content                                                                                                                                                             | Release         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1     | Repository reset and configuration: CI, policy checks, OpenSSF, templates, project board, issues, this wiki, and the release pipeline.                              | `1.0.0-alpha.1` |
| 2     | Build pipeline, extraction of browser support data, and the coverage check at feature level and for reference tables.                                               | alpha           |
| 3     | The shell (layout, topic tree, command palette, theme, readout bar) and the editor (tabs, highlighting, toolbar, share link, download, persistence).                | alpha           |
| 4     | Preview runner on Cloudflare Pages, "Open in own window", the demo Worker, the PWA, and deployment to all three targets.                                            | alpha           |
| 5     | Topic batches: HTML, CSS, JavaScript language, stable Web APIs, device, permission, experimental and network APIs, and recipes. Each batch ends with a pre-release. | beta            |
| 6     | Full quality pass, and the maintainer's review of the exclusion list for the coverage check.                                                                        | beta            |
| 7     | The `1.0.0` release.                                                                                                                                                | `1.0.0`         |

## After 1.0.0

Stages 2 to 7 are the plan up to `1.0.0`. After that, the work is maintenance. No dates are promised.

- Refresh the browser support data from MDN browser-compat-data and web-features on a schedule.
- Add a feature page or table entry when a feature reaches Baseline in web-features.
- Fix reported bugs and accessibility barriers.

Versions follow conventional commits, as described in [[Release process]]: `feat` bumps the minor version, `fix` the patch version, and a breaking change the major version.

## Where to follow the work

Progress is tracked on the GitHub project linked to the repository. Each stage and each batch of topics has an issue. Ideas and questions go to the discussions.

See [[Release process]] for the alpha and beta rule, [[Architecture]] for the parts each stage builds, and [[Topic catalogue and coverage]] for what stage 5 has to cover.
