This page describes how the finished site is put together. Parts that are not built yet are marked as planned. The build pipeline exists since stage 2.

## Pieces

The site has three deployed parts, all published from the same commit so their versions match:

1. The shell, a static site on GitHub Pages. It holds the topic pages, the navigation, the search, the editor and the readout bar.
2. The preview runner, a small fixed page on Cloudflare Pages. It lives on a different origin from the shell and runs the code visitors edit.
3. The demo Worker, a Cloudflare Worker on the free tier. It is the server-side counterpart for demos that need a real network peer.

Why two origins: all project pages under `github.io` share a single origin. Code a visitor types into an editor must not run there, because it could reach the shell's IndexedDB and caches. See the [[Security model]].

## Repository layout

Present today:

```text
scripts/build.mjs   entry of the build (npm run build)
scripts/build/      the build modules and the coverage check
scripts/policy/     repository policy checks
scripts/release/    version and release-note helpers
scripts/wiki/       wiki link check and sync
content/coverage/   exclusions, pending units and locked support claims
tests/unit/         node:test unit tests
wiki/               source of this wiki
.github/            workflows, issue forms, templates
dist/               build output, not committed
```

Planned:

```text
content/            topic pages and demos, one file per demo (stage 5)
src/shell/          site CSS, editor, palette, readout, PWA code
src/fonts/          IBM Plex WOFF2 files and the licence
preview/            the preview runner
worker/             the demo Worker with its tests
```

## Content model

A topic is a folder with a `topic.md` file and one `.demo.html` file per demo. A demo file holds a meta block and one `template` element per language (HTML, CSS, JavaScript). [[Writing a demo]] documents the format.

## Build

The build is a Node script without a framework. `npm run build` runs `scripts/build.mjs`, which reads `content/` and the two data packages and writes the finished site to `dist/site`. The modules in `scripts/build/` each do one job: reading front matter and demo files, converting the Markdown subset, extracting support data, rendering pages and writing the data files. Two builds of the same tree are byte-identical, and CRLF and LF sources give the same output.

The output folder is refused unless it lies strictly below `dist/` and neither `dist/` nor a folder on the way to it is a symlink or junction. The build deletes the folder before it writes, and this check keeps a wrong value from reaching anything else.

Content errors are collected and reported with a file and line, for example `content/html/dialog/01-basic.demo.html:12 unclosed <template>`. The build stops before it writes anything.

What ends up in `dist/site`, and which stage uses it:

| File                                 | Content                                              | Used by                |
| ------------------------------------ | ---------------------------------------------------- | ---------------------- |
| `index.html`                         | Home page with the topics of each category           | Stage 3 restyles it    |
| `<category>/<slug>/index.html`       | One page per topic: text, demo code, reference table | Stage 3 restyles it    |
| `data/compat/<category>/<slug>.json` | Topic summary and one entry per demo                 | Stages 3 and 4         |
| `data/nav.json`                      | Categories and topics in order                       | Stage 3 navigation     |
| `data/search-index.json`             | Topics, demos and features with search terms         | Stage 3 search         |
| `precache.json`                      | A version hash and the URL of every file             | Stage 4 service worker |
| `sitemap.xml`, `robots.txt`          | Absolute sitemap URLs and a crawl rule               | Search engines         |

The compat files are described in [[Browser support data]]. The stage 2 pages are plain semantic HTML with no CSS and no script. Each page carries the shell's Content-Security-Policy in a `meta` tag. The code that hashes inline scripts and styles exists already, and stage 3 uses it once pages carry any.

Every site URL the build generates (navigation, search index, topic data, precache list, canonical links and the sitemap) starts with the site base `/HTML-Template/`, because the shell lives at `https://vectode.github.io/HTML-Template/`. The `Allow: /` line in `robots.txt` is a path rule, not a URL. The file is written to the site root, which is served at `/HTML-Template/robots.txt`. Crawlers read it only at the root of a host, so on a GitHub Pages project site the file has no effect. The sitemap has to be submitted another way, for example in Search Console.

`npm run build` does not run the completeness check. That is its own command, `npm run coverage`, described in [[Topic catalogue and coverage]]. In CI the job `build` runs the build, then the coverage check, and uploads `dist/site` as the artifact `site`.

The output has no runtime dependencies. Fonts are self-hosted, and the shell talks to no third-party origin.

## Hosting and PWA

The shell is deployed by GitHub Actions to GitHub Pages. The runner and the Worker are deployed from the same workflow. The site is installable: a web manifest and a service worker precache the shell and pages, with an offline fallback page.

Stage 2 built the pipeline and the coverage check. Stages 3 and 4 build the shell, the editor, the runner, the Worker and the PWA. See the [[Roadmap]].
