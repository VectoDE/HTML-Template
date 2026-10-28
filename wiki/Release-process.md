Releases are tagged, built, signed and published by two workflows. `tag` creates the version tag when a stage issue is closed, and `release` builds and publishes the signed release for that tag. Nobody types a version number. This page explains how the version is chosen, what a release contains and how to verify what you downloaded.

## How a release happens

1. The owner closes a stage issue as completed. The stage issues and their release channels are listed in `.github/release-stages.json`. Wait until `ci` and `codeql` are green on `main` before closing the issue, and close stage issues one at a time, each after the previous release has its tag. GitHub keeps only one waiting run of the `tag` workflow, so a third close during a running one is dropped.
2. The `tag` workflow runs its guards. The issue must be closed as completed, listed in `release-stages.json` and opened by the repository owner. The person who closed it needs the admin or maintain role. For the head commit of `main`, the newest push runs of `.github/workflows/ci.yml` and `.github/workflows/codeql.yml` must have completed with success, the commit must not carry a `v*` tag already, and the new tag must not exist yet. The workflows are matched by file path, so a run of another workflow with the same job names does not count. If a guard fails, the workflow ends with a notice and creates nothing. When that happened because the checks were not finished yet, reopen the issue and close it again once they are green.
3. The workflow works out the next version, creates the tag `v<version>` on the head commit of `main` and starts the `release` workflow on that tag.
4. The `build` job first checks who started the run. A release may come from a tag that the repository owner pushed, or from a `workflow_dispatch` by the `tag` workflow, which runs as `github-actions[bot]`. A re-run keeps the original actor and records who re-ran it as the triggering actor. The owner may re-run a release that the `tag` workflow started, and a re-run by anyone else stops here. The job then checks that the tagged commit is on `main`, runs lint and tests, stamps the version into the built `package.json` and `package-lock.json`, packages the archive, creates the SBOM and writes the release notes. The `provenance` and `sign` jobs run next. The `publish` job then creates the GitHub release in the `release` environment, which accepts only tags that match `v*`. There is no manual approval step.
5. The workflow comments on the closed issue with the tag and a link to the release runs. Verify the release with the commands below before announcing it.

The tag is the only place the version lives. `package.json` and `package-lock.json` in the repository keep `0.0.0-development`, and the stamped version exists only inside the release archive.

## Versions

Until 1.0.0, the channel of the closed issue decides the version:

- An `alpha` issue gives `1.0.0-alpha.1` for the first tag and counts up from the last alpha after that.
- A `beta` issue gives `1.0.0-beta.1` after the last alpha and counts up from the last beta after that.
- The `final` issue gives `1.0.0`.

The last tag is the highest `v*` tag in semver order, so `1.0.0-alpha.10` comes after `1.0.0-alpha.9`. A channel can only move forward. Closing an alpha issue after the first beta, or any stage issue after 1.0.0, makes the `tag` workflow fail without creating a tag.

Pre-releases are marked as such on GitHub and go through the same pipeline as 1.0.0. See the [[Roadmap]] for which stage produces which pre-release.

After 1.0.0 the version will come from the commit types: a breaking change raises the major version, `feat` the minor version and `fix` or `perf` the patch version. The script for this exists, and no workflow uses it yet.

## Release notes

The notes are generated from the commits between the previous `v*` tag and the new one. The first release starts at `notesBase` in `release-stages.json`, the last commit before the rebuild, so the old template history stays out. Commits are grouped into Features (`feat`), Fixes (`fix` and `perf`) and Other, and breaking changes are marked. A range without commits gives the single line "No changes." That is why the commit type matters. Pull requests are squash-merged, so the pull request title becomes the commit on `main` and is the line that ends up in the notes. [Contributing](https://github.com/VectoDE/HTML-Template/blob/main/CONTRIBUTING.md#commits) lists the types.

## What a release contains

For version `<v>`:

- `html-template-<v>.tar.gz`, the source archive of the tagged commit with the version stamped into `package.json` and `package-lock.json`,
- `html-template-<v>.spdx.json`, the SBOM in SPDX format,
- a `.sigstore.json` bundle for each of those two files, made with Sigstore keyless signing,
- `html-template-<v>.intoto.jsonl`, the SLSA provenance.

## Verify a release

Download the assets of one release into a folder. You need `cosign` and `slsa-verifier`.

Check the signature of the archive and of the SBOM:

```sh
cosign verify-blob \
  --bundle html-template-<v>.tar.gz.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/VectoDE/HTML-Template/\.github/workflows/release\.yml@refs/tags/v[0-9].*$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  html-template-<v>.tar.gz
```

Repeat it with `html-template-<v>.spdx.json` and its bundle.

Check the provenance:

```sh
slsa-verifier verify-artifact html-template-<v>.tar.gz \
  --provenance-path html-template-<v>.intoto.jsonl \
  --source-uri github.com/VectoDE/HTML-Template \
  --source-tag v<v>
```

Both commands print a success message and exit with 0. Any other result means verification failed. Do not use the file until you know why.

The `release` workflow runs only on a tag ref, whether the tag push or `tag` started it. The signing identity is therefore always `release.yml@refs/tags/v<v>`, and both commands work the same for every release.

## Manual fallback

If the `tag` workflow cannot run, the owner can push a tag by hand:

1. Make sure `main` is green.
2. Pick the next version by the rules above and create the tag `v<version>` on the head commit of `main`.
3. Push the tag. The push starts the `release` workflow, and everything from step 4 above runs as usual.

If a release fails after its tag exists, the owner starts it again on the same tag. Either use "Re-run failed jobs" on the failed run, or run `gh workflow run release.yml --ref v<version>`, which is the same as choosing the tag under "Run workflow" in the Actions tab. Do not create a second tag for the same commit, because the `tag` workflow skips a commit that already has one.
