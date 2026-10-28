This page is for contributors who want to add or fix a demo. The demo format is fixed in stage 2 together with the build, so the file format below is the plan and may change in details. The rules in the second half apply now.

## Format

One demo is one file, `content/<category>/<topic>/<nn>-<slug>.demo.html`. It has a meta block and up to three `template` elements, one each for `data-lang="html"`, `data-lang="css"` and `data-lang="js"`. Any of the three may be empty.

The meta block holds:

- the title,
- one to three sentences on when to use the feature,
- an accessibility note where one applies,
- the fallback behaviour,
- the compat feature keys the demo uses, for example `css.properties.anchor-name`,
- a feature-detect expression that the readout evaluates in the visitor's browser,
- `runsIn: frame` or `runsIn: window`, depending on whether the demo can run inside a sandboxed iframe.

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
4. The compat keys exist and the coverage check is green.
5. The text reads plainly: specific, no marketing words.
6. Commits are signed off (`git commit -s`) and reference the issue.

See [[Accessibility guidelines]] for the accessibility bars and [[Testing guide]] for how demos are tested.
