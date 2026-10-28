The visual design is set and will be built in stage 3, so nothing on this page is shipped yet. It holds the tokens and rules so that the implementation and reviews share one source.

## Layout

A workbench layout with a persistent topic tree on the left, a compact header, and a workspace in the middle of the page. The header carries the site name, a search field (Ctrl K opens the command palette from anywhere), the theme switch (Light, Dark, Auto) and a link to GitHub.

A topic starts with a breadcrumb, a heading and a short lede. Below sits a row of facts: topic number and name, Baseline status, interface, permission, number of demos and the specification link. Demos are numbered tabs. The workspace shows the editor on the left and the preview on the right with a drag handle between them. A dark readout bar underneath shows the support light, the permission or fallback note, whether the page is on HTTPS, and the cursor position.

Below about 1024 px the tree becomes a drawer, and the editor and preview stack with a tab switch.

## Shape

Square corners and 1 px hairlines. Signal yellow marks the active state and the cursor or selection only. The only shadows are the focus ring and the palette overlay.

## Colour

| Role                   | Light     | Dark      |
| ---------------------- | --------- | --------- |
| Background             | `#E6E8EB` | `#0F1217` |
| Surface                | `#F7F8FA` | `#171B22` |
| Text                   | `#0E1116` | `#E6E9EE` |
| Accent (cobalt)        | `#2440E6` | `#6E83FF` |
| Active (signal yellow) | `#FFD23F` | `#FFD23F` |

The language markers are small squares: HTML `#FF9E64`, CSS `#7DCFFF`, JavaScript `#E8C468`. Syntax colours are chosen within this palette and must reach AA contrast.

## Type

- IBM Plex Mono for the interface and for code.
- IBM Plex Sans for reading text.
- IBM Plex Sans Condensed Bold for headings.

The fonts are under the SIL Open Font License 1.1. The WOFF2 files are subset, hosted with the site and shipped with the licence file. No font is loaded from another origin.

## Motion

Only the palette opening and closing and the feedback while a panel is resized move. `prefers-reduced-motion` turns these off.

## What to avoid

The site should look like a tool made for developers, so it uses no uniform grids of rounded cards, gradient blobs, glass effects or emoji as icons.

See [[Accessibility guidelines]] for the contrast and keyboard bars the design has to meet.
