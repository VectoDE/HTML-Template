This page describes how the finished site is put together. Parts that are not built yet are marked as planned.

## Pieces

The site has three deployed parts, all published from the same commit so their versions match:

1. The shell, a static site on GitHub Pages. It holds the topic pages, the navigation, the search, the editor and the readout bar.
2. The preview runner, a small fixed page on Cloudflare Pages. It lives on a different origin from the shell and runs the code visitors edit.
3. The demo Worker, a Cloudflare Worker on the free tier. It is the server-side counterpart for demos that need a real network peer.

Why two origins: all project pages under `github.io` share a single origin. Code a visitor types into an editor must not run there, because it could reach the shell's IndexedDB and caches. See the [[Security model]].

## Repository layout

Present today:

```text
scripts/policy/    repository policy checks
scripts/release/   version and release-note helpers
scripts/wiki/      wiki link check and sync
tests/unit/        node:test unit tests
wiki/              source of this wiki
.github/           workflows, issue forms, templates
```

Planned:

```text
content/           topic pages and demos, one file per demo
src/shell/         site CSS, editor, palette, readout, PWA code
src/fonts/         IBM Plex WOFF2 files and the licence
scripts/build.mjs  the build
preview/           the preview runner
worker/            the demo Worker with its tests
dist/              build output, not committed
```

## Content model

A topic is a folder with a `topic.md` file and one `.demo.html` file per demo. A demo file holds a meta block and one `template` element per language (HTML, CSS, JavaScript). [[Writing a demo]] documents the format.

## Build

The build is a Node script without a framework. It reads the content, writes plain HTML, CSS and JavaScript, and produces:

- the pages and the navigation,
- a search index that works offline,
- the browser support data per topic and demo (see [[Browser support data]]),
- the sitemap, the service worker precache list and the CSP hashes,
- the completeness check described in [[Topic catalogue and coverage]].

The output has no runtime dependencies. Fonts are self-hosted, and the shell talks to no third-party origin.

## Hosting and PWA

The shell is deployed by GitHub Actions to GitHub Pages. The runner and the Worker are deployed from the same workflow. The site is installable: a web manifest and a service worker precache the shell and pages, with an offline fallback page.

Stage 2 builds the pipeline. Stages 3 and 4 build the shell, the editor, the runner, the Worker and the PWA. See the [[Roadmap]].
