The site aims to cover HTML, CSS and JavaScript with its Web APIs completely, including experimental, browser-specific and permission-gated APIs. Nothing exists yet beyond the plan on this page. The catalogue is written in stages 5 and 6 and the coverage check is built in stage 2.

## Grouping

Features are grouped by topic. The target is roughly 80 to 120 topic pages with three to eight demos each, not one page per element or property. The starting list is:

- HTML, about 22 topics: document structure, landmarks, text semantics, links, images, media, embedded content, SVG, MathML, tables, forms, `dialog`, popovers, templates and shadow DOM, global attributes, structured data, accessibility with native HTML.
- CSS, about 36 topics: the cascade and `@layer`, selectors, custom properties, nesting, `@scope`, layout (box model, flexbox, grid, subgrid, positioning, anchor positioning), container queries, media queries and user preferences, typography, colour, backgrounds and shapes, filters, masks, transforms, transitions, animations, scroll-driven animations, view transitions, scroll snap, math functions, containment, forms styling, print, Houdini, `@supports`, units.
- JavaScript and Web APIs, about 46 topics: language features, async code, built-ins, the DOM and events, custom elements, observers, fetch and streams, WebSockets, storage, the File System APIs, clipboard, workers, notifications, sensors, media capture, Web Audio, Canvas, WebGL, WebGPU, WebCodecs, hardware APIs (Bluetooth, USB, HID, Serial, NFC), Gamepad, Share, Payment Request, credentials, history and navigation, performance, Web Crypto, `Intl`, the Web Animations API, permissions.
- Recipes, about 16: accessible modal flow, toast stack, combobox, tabs, sortable list, responsive data table, form wizard, theme switcher, lightbox gallery, upload with progress, offline notes app, live search, reading progress, page transitions, camera snapshot.

The list is a starting point. The coverage check decides what is missing.

## What must be covered

The build reads the namespaces `html`, `css`, `api`, `javascript`, `svg` and `mathml` of `@mdn/browser-compat-data`. The `http` and `webassembly` namespaces appear in reference tables where they belong to a topic, for example HTTP headers on a fetch or CORS topic.

There are two levels:

- Feature level. Every HTML element, every CSS property, every at-rule, selector and function at its top level, every Web API interface, every JavaScript built-in and every SVG and MathML area needs a running demo. A demo claims a feature by listing its compat key.
- Sub-entry level. Values, options, methods, attributes, events and parameters need no demo of their own. They appear in a reference table on the topic page, generated from the compat data with the browser versions for each entry.

## Exclusions

A key that is neither covered nor excluded fails the build. An exclusion has a written reason, such as "removed from all browsers", "non-standard alias of another key" or "internal to another feature". The maintainer keeps the list and reviews it before each release. Deprecated and removed features are not taught, but they are listed in a deprecated appendix per category with the replacement, and they count toward completeness.

## Which `http` and `webassembly` keys count

This rule is set when the coverage check is built in stage 2 and written down here at that point.

See [[Browser support data]] for where the data comes from and [[Writing a demo]] for how a demo declares its keys.
