This page is for contributors who want to add or fix a demo. The format below is what the build reads since stage 2. A file that breaks a rule fails `npm run build` with the file and the line. Demo pull requests open together with the topic batches in stage 5, so until then demos are requests in issues. The rules in the second half apply to every demo.

## Where files live

A topic is a folder, and a demo is a file in it:

```text
content/<category>/<topic>/topic.md
content/<category>/<topic>/<nn>-<slug>.demo.html
```

- `<category>` is `html`, `css`, `js` or `recipes`.
- `<topic>` and `<slug>` use lowercase letters, digits and single hyphens.
- `<nn>` is a two-digit number from `01`. It orders the demos and must be unique within the topic. The demo gets the page anchor `demo-<n>`.
- Nothing else may sit in a topic folder. A topic needs at least one demo, unless it is a deprecated appendix (see [[Topic catalogue and coverage]]).
- Symbolic links are refused. CRLF line endings and a byte order mark are accepted.

## topic.md

The file starts with a front matter block between two `---` lines, followed by the text of the topic.

| Key         | Required | Value                                                                   |
| ----------- | -------- | ----------------------------------------------------------------------- |
| `title`     | yes      | Text.                                                                   |
| `number`    | yes      | A positive integer, unique within the category. It orders the topics.   |
| `lede`      | yes      | One or two sentences that open the page.                                |
| `spec`      | yes      | One `https://` URL, or a list of them.                                  |
| `interface` | no       | The main interface or element, shown in the spec plate.                 |
| `mdn`       | no       | An `https://` URL.                                                      |
| `tables`    | no       | A list of compat keys the topic covers at table level (no demo needed). |
| `appendix`  | no       | Only `deprecated`. See [[Topic catalogue and coverage]].                |

Unknown keys are errors. The front matter is a small subset of YAML: `key: value`, lists as `[a, b]` or as lines starting with `- `, and nothing nested. Indent with spaces, not tabs.

The text uses a Markdown subset: paragraphs, `-` and `1.` lists (one level), fenced code blocks, headings from `##` to `####`, inline code, `**strong**`, `*emphasis*` and `[links](https://example.org)`. The page owns the `h1`, so the text starts at `##` and may not skip a level. A line that starts with raw HTML is an error. HTML inside a line is shown as text. Images, tables, quotes and nested lists are not supported, but they are not errors either. The build renders them as plain text or as a flat list. Link targets must start with `https://`, `http://`, `#`, `./` or `../`, and may not contain spaces or parentheses. `javascript:` and `data:` targets are errors.

## The demo file

One demo is one file. It starts with a meta block, a `script` element that holds JSON. After it come up to three `template` elements, one each for `data-lang="html"`, `data-lang="css"` and `data-lang="js"`. Each language may appear once, and at least one must be there. Any other text between the blocks is an error.

The meta keys:

| Key           | Required | Value                                                                                                     |
| ------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| `title`       | yes      | Text.                                                                                                     |
| `summary`     | yes      | One to three sentences on when to use the feature.                                                        |
| `a11y`        | no       | An accessibility note, where one applies.                                                                 |
| `fallback`    | yes      | What happens where the feature is missing.                                                                |
| `features`    | yes      | A list of compat keys the demo uses, for example `css.properties.anchor-name`. No duplicates. See below.  |
| `detect`      | yes      | A feature-detect expression as a string, on one line and at most 200 characters.                          |
| `runsIn`      | yes      | `frame` or `window`, depending on whether the demo can run inside a sandboxed iframe.                     |
| `permissions` | no       | A list of permission names. Allowed names are listed in `scripts/build/config.mjs`, for example `camera`. |

A key in `features` must start with one of the namespaces `html`, `css`, `api`, `javascript`, `svg`, `mathml`, `http` or `webassembly`, and it must exist in the compat data, otherwise the build names the file. The topic page shows the permissions of its demos in the spec plate, so a topic has no `permissions` key of its own.

`detect` is only stored. The build and the shell never run it, because the shell's Content-Security-Policy forbids `eval`. The preview runner evaluates it in stage 4.

A complete example, with a `template` element inside the HTML code:

```text
<script type="application/json" data-demo-meta>
  {
    "title": "A template that is cloned on demand",
    "summary": "Use a template when markup should exist once but appear many times, without rendering until you ask for it.",
    "a11y": "The cloned list items keep their text, so screen readers read them as normal list entries.",
    "fallback": "Browsers without the element see the empty list and the button does nothing.",
    "features": ["html.elements.template"],
    "detect": "'content' in document.createElement('template')",
    "runsIn": "frame"
  }
</script>

<template data-lang="html">
  <ul id="list"></ul>
  <button type="button" id="add">Add item</button>
  <template id="item"><li>New item</li></template>
</template>

<template data-lang="js">
  const list = document.querySelector('#list');
  const item = document.querySelector('#item');
  document.querySelector('#add').addEventListener('click', () => {
    list.append(item.content.cloneNode(true));
  });
</template>
```

Nested `template` elements are matched by counting, so they stay part of the code. An unclosed `template` fails with the line where it opens. A stray closing tag ends the block early and fails at the text after it. Code inside a block is dedented by its common indent, and blank lines at its start and end are dropped.

## Rules

A demo has to be something you could paste into a real project. That means:

- Semantic markup, labelled controls and visible focus.
- `prefers-reduced-motion` is respected wherever something moves.
- Every error path is handled. Permission denied, dismissed, timed out and unsupported each end in a visible state.
- No `console.log` left over from debugging.
- Permission-gated APIs (camera, microphone, geolocation, notifications, Bluetooth, USB, serial, HID, clipboard, screen capture) ask only after a click on an explicit button, never on load.
- Experimental or browser-specific APIs are feature-detected. Where the API is missing, the demo shows which browsers and versions support it, taken from the compat data, with a static explanation. It must not throw.
- Current practice only. No float layouts, jQuery idioms, `document.write` or vendor-prefix-only recipes. A removed or deprecated feature appears only in the deprecated appendix of its category, with the replacement.

Do not copy MDN prose. Keep the explanation short and link to the specification and to MDN for depth.

## Checklist before you open a pull request

1. The demo runs without console errors in a current Chromium, Firefox and WebKit.
2. You can use it with the keyboard alone.
3. The unsupported and denied states are visible and have been tried by hand.
4. `npm run build` and `npm run coverage` both finish without errors. Every compat key exists, and the keys your demo lists are no longer pending. If the check asks for it, run `npm run coverage:update` and commit the changed files in `content/coverage`.
5. The text reads plainly: specific, no marketing words.
6. Commits are signed off (`git commit -s`) and reference the issue.

See [[Accessibility guidelines]] for the accessibility bars and [[Testing guide]] for how demos are tested.
