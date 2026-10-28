The site aims to cover HTML, CSS and JavaScript with its Web APIs completely, including experimental, browser-specific and permission-gated APIs. The coverage check exists since stage 2. The catalogue itself is written in stages 5 and 6, so every unit is still pending today.

## Grouping

Features are grouped by topic. The target is roughly 80 to 120 topic pages with three to eight demos each, not one page per element or property. The starting list is:

- HTML, about 22 topics: document structure, landmarks, text semantics, links, images, media, embedded content, SVG, MathML, tables, forms, `dialog`, popovers, templates and shadow DOM, global attributes, structured data, accessibility with native HTML.
- CSS, about 36 topics: the cascade and `@layer`, selectors, custom properties, nesting, `@scope`, layout (box model, flexbox, grid, subgrid, positioning, anchor positioning), container queries, media queries and user preferences, typography, colour, backgrounds and shapes, filters, masks, transforms, transitions, animations, scroll-driven animations, view transitions, scroll snap, math functions, containment, forms styling, print, Houdini, `@supports`, units.
- JavaScript and Web APIs, about 46 topics: language features, async code, built-ins, the DOM and events, custom elements, observers, fetch and streams, WebSockets, storage, the File System APIs, clipboard, workers, notifications, sensors, media capture, Web Audio, Canvas, WebGL, WebGPU, WebCodecs, hardware APIs (Bluetooth, USB, HID, Serial, NFC), Gamepad, Share, Payment Request, credentials, history and navigation, performance, Web Crypto, `Intl`, the Web Animations API, permissions.
- Recipes, about 16: accessible modal flow, toast stack, combobox, tabs, sortable list, responsive data table, form wizard, theme switcher, lightbox gallery, upload with progress, offline notes app, live search, reading progress, page transitions, camera snapshot.

The list is a starting point. The coverage check decides what is missing.

## What must be covered

The coverage check reads the namespaces `html`, `css`, `api`, `javascript`, `svg` and `mathml` of `@mdn/browser-compat-data`, plus the parts of `http` and `webassembly` named below. It breaks them into units. In version 8.1.7 of the data there are 2800 units: 2317 at feature level and 483 at table level. These numbers move with every data update, and the CI summary of each run shows the current ones.

There are two levels:

- Feature level. A unit needs a running demo. A demo claims a unit by listing its compat key, or the key of a part of it.
- Table level. A unit needs no demo of its own. A topic claims it with a `tables:` list in its front matter, and its entries appear in the reference table of that topic.

Below a unit, values, options, methods, attributes, events and parameters need no demo. They appear in the reference table of the topic that covers the unit, with the browser versions for each entry. A key that a demo or a `tables:` list names stands for its whole unit, so a table never shows only part of one.

Which keys are units, and at which level:

| Prefix                                                                                                                                                | Unit is the key                     | Level   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------- |
| `html.elements`, `css.properties`, `css.at-rules`, `css.selectors`, `css.types`, `api`, `javascript.builtins`, `svg.elements`, `mathml.elements`      | one segment below the prefix        | feature |
| `html.global_attributes`, `svg.global_attributes`, `mathml.global_attributes`, `mathml.attribute_values`                                              | one segment below the prefix        | table   |
| `javascript.classes`, `javascript.functions`, `javascript.grammar`, `javascript.operators`, `javascript.regular_expressions`, `javascript.statements` | one segment below the prefix        | table   |
| `http`                                                                                                                                                | two segments, `http.<group>.<name>` | table   |
| `webassembly.api`                                                                                                                                     | one segment below the prefix        | table   |

`css.types` includes the CSS functions and units. A prefix, or a node between a prefix and the unit depth, is a table unit of its own when it carries compat data, for example `http.data-url` or `javascript.classes`.

### `http` and `webassembly`

Every key of the form `http.<group>.<name>` counts at table level, for example headers, methods and status codes. A new group in the data is picked up without a new rule. These keys belong in a topic where they fit, for example HTTP headers in a fetch or CORS topic.

Of `webassembly`, only `webassembly.api` counts, at table level. This is the JavaScript API that loads and runs a module. Instructions, types, definitions and proposal flags describe the WebAssembly language itself, which lies outside HTML, CSS and JavaScript, so they do not count. The namespaces `manifests`, `mediatypes`, `webdriver` and `webextensions` do not count either. A topic may still list their keys in `tables:` for its reference table.

## Covered, excluded, pending

Each unit is in exactly one of three states:

- Covered. A demo lists the key (feature level), or a demo or a `tables:` list does (table level). A listed key below the unit covers it too.
- Excluded. The key is in `content/coverage/exclusions.json`.
- Pending. Neither of the above yet.

`content/coverage/pending.json` lists every pending unit. It has to match the computed set exactly. A unit that is missing from it fails the check by name, and so does a listed unit that is already covered or excluded, no longer exists, or is not a unit. This is how a data update that adds a key shows up in CI: the check names the key and says which command fixes the list. Run `npm run coverage:update` to rewrite `pending.json` and `claims.json`. [[Browser support data]] describes the routine for a data update.

Pre-releases may ship with pending units. The final `1.0.0` release runs the check with `--strict`, which fails while any unit is still pending.

The commands:

```sh
npm run coverage
npm run coverage -- --strict
npm run coverage:update
```

The first checks and exits with 1 on any problem. The last rewrites `pending.json` and `claims.json` from the current data and the content. In a GitHub Actions run the check also writes a summary table, with the first fifty problems, to the step summary. It also checks that every sub-entry of a covered unit appears in the reference table of its topic.

`npm run build` does not run the check. The CI job `build` runs both, one after the other.

## Exclusions

`exclusions.json` is a list of entries with a key and a written reason:

```json
[
  {
    "key": "html.elements.acronym",
    "reason": "Deprecated alias of the abbr element, kept out of the teaching content."
  }
]
```

The key must exist in the compat data. The reason needs at least ten characters and should say why, for example "removed from all browsers", "non-standard alias of another key" or "internal to another feature". An excluded key also excludes everything below it. A key cannot be both excluded and listed by a demo or a `tables:` list. The maintainer keeps the list and reviews it before each release.

## Deprecated appendix

Deprecated and removed features are not taught. They are listed in a deprecated appendix per category with the replacement, and they count toward completeness. A topic marks itself with `appendix: deprecated` in its front matter. It needs no demos and covers feature units through its `tables:` list. A feature unit in such a list must be deprecated in the data or removed, which means that none of the seven tracked browsers supports it in its chosen statement. Anything else fails the check by name.

See [[Browser support data]] for where the data comes from and [[Writing a demo]] for how a demo declares its keys.
