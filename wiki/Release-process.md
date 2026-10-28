Releases are built, signed and published by the `release` workflow when a tag is pushed. This page explains the tags, the pre-release rule and how to verify what you downloaded.

## Tags

A tag is `v` followed by a semantic version, for example `v1.0.0-alpha.1`. Tags are annotated. The tagged commit has to be on `main`, or the workflow stops. The version in `package.json` and the tag name must agree.

## Pre-releases

Version 1.0.0 is published only when all topics are done. Until then each stage ends with a signed pre-release:

- `1.0.0-alpha.N` while the shell and tooling are built (stages 1 to 4),
- `1.0.0-beta.N` once topics are being added (stage 5 onwards).

Pre-releases are marked as such on GitHub. They go through the same pipeline as the final release.

## What a release contains

For version `<v>`:

- `html-template-<v>.tar.gz`, the source archive of the tagged commit,
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

## How a maintainer cuts a release

1. Make sure `main` is green and `package.json` has the new version.
2. Create an annotated tag `v<version>` on the commit and push it.
3. The `build` job runs lint and tests, packages the archive and creates the SBOM. The `provenance` and `sign` jobs run next. The `publish` job then creates the GitHub release. It runs in the `release` environment, which accepts only tags that match `v*`. There is no manual approval step.
4. Verify the release with the commands above before announcing it.

See the [[Roadmap]] for which stage produces which pre-release.
