No version number on the site is written by hand. Support data comes from two packages, is extracted by the build, and is read again in the visitor's browser. The extraction exists since stage 2. The readout in the browser comes with the shell in stage 3 and the runner in stage 4.

## Sources

- `@mdn/browser-compat-data` provides, per feature, the first version in each browser, plus flags, prefixes and deprecation status.
- `web-features` provides the Baseline status of a feature and the year it reached it.

Both are dev dependencies with exact versions. They are used when the site is built and are not part of what is shipped. The versions in use are printed in the coverage summary of every CI run.

## Browsers

Seven browsers are tracked, named as in the compat data: `chrome`, `chrome_android`, `edge`, `firefox`, `firefox_android`, `safari` and `safari_ios`. Every extracted entry holds a value for all seven, even when the data has nothing for one of them.

## Choosing a statement

The compat data may list several support statements for one browser. The build takes the first statement that has no `flags`, no `prefix`, no `alternative_name` and no `version_removed`. If no such statement exists, it takes the first one and keeps its annotations. The result for one browser has these fields:

- `added` is a version string, `false` when the browser does not support the feature, or `null` when the data has no usable statement. The string `preview` is kept as it is.
- `approx` is set when the data says "or earlier". The data writes this as `≤37`, and the build stores `added: "37"` with `approx: true`. The page shows it as `≤37`.
- `removed` is the version a feature was removed in, when the chosen statement has one.
- `partial`, `prefix`, `altName` and `flags` carry the matching annotations of the statement.

## Baseline

The Baseline status of a compat key comes from `web-features`. The status is `high`, `low` or `false`. The year is the year of `baseline_low_date`. When several features in `web-features` list the same key, the weakest status wins.

A topic gets the weakest status among the keys of its demos, and the latest year among them. A key without Baseline data makes the topic's Baseline unknown, and the page then says "Baseline unknown" instead of "Limited availability".

## At build time

The build writes one JSON file per topic to `data/compat/<category>/<slug>.json`. It holds the topic summary (title, number, interface, specification and MDN links, permissions, Baseline) and one entry per demo. A demo lists the compat keys it exercises, and the build resolves each key to its support, status flags, specification and MDN links and Baseline. The same file carries the reference table rows. The spec plate at the top of a topic and the reference table on the page are rendered from this data. The Permission value on the plate is derived from the permissions its demos declare. Compat keys that the data does not know make the build fail and name the demo file.

The keys the build checks, and the exclusions, are described in [[Topic catalogue and coverage]].

## The claims lock

`content/coverage/claims.json` stores the whole resolved entry of every key that a demo lists under `features`: the support per browser, the status flags, the MDN and specification links and the Baseline data. The coverage check compares all of it, so a change to any of these fails when the file differs from the current data, so a data update shows which claims moved, as a diff of this file.

The lock has limits. It covers only the keys a demo lists. Sub-entries that appear in a reference table, and units that have no compat data of their own, are not locked. Those rows follow the data without a diff.

## In the browser

Each demo declares a feature-detect expression in its meta block, as a string. The build never runs it, and the shell does not either, because the shell's Content-Security-Policy forbids `eval`. The preview runner evaluates it in stage 4 and shows a green, amber or red light, the browser and version, and the fallback note. The readout also says whether the page runs in a secure context, because many APIs need HTTPS.

## Keeping it current

Dependabot checks the npm dependencies weekly. The two data packages sit in their own group, `compat-data`, and are not held back by the seven-day cooldown that applies to other updates. Updates to both go into one pull request.

That pull request needs one extra step before it can merge. A new release of the data usually adds, removes or changes keys, and the coverage check compares the result with two committed files:

1. `pending.json` must equal the set of units that are neither covered nor excluded, as computed from the data. A new unit, or one that was removed upstream, makes CI fail and name the key.
2. `claims.json` locks the resolved support of the demo keys, as described above.

On the branch of the pull request, run:

```sh
npm ci --ignore-scripts
npm run coverage:update
git add content/coverage
git commit -s -m "chore(deps): update the coverage files"
```

`coverage:update` rewrites both files from the new data. Look at the diff before you commit it. A moved claim is a support statement on the site that changed, and a new pending key is a unit that still needs a demo, a table entry or an exclusion with a reason. `coverage:update` does not touch `exclusions.json`, and a stale entry there still fails the check by name.

There is no scheduled workflow for this. A pull request opened with the workflow token would not start the required checks.

## Wrong data

If a support claim looks wrong, check the compat key in the upstream data first. Report upstream errors to the `mdn/browser-compat-data` project. If the site reads the data incorrectly, open an issue here.

Related pages: [[Architecture]], [[Writing a demo]].
