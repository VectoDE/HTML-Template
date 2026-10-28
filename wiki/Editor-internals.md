The editor is planned for stage 3, and its preview runner for stage 4. This page records the design so that later work and reviews have one reference. Nothing here is built yet.

## Principles

The editor is written for this project and uses no dependencies. It has to keep what people expect from a text field: native undo, selection, IME input and screen-reader editing.

## Editing

- Three tabs: HTML, CSS and JavaScript, each marked with a small colour square.
- The editing surface is either a `textarea` laid over a highlighted `pre`, or a `contenteditable="plaintext-only"` element. The choice is made when the editor is built, and it has to meet the requirement above.
- A small hand-written tokenizer per language does the syntax highlighting.
- Line numbers, Tab and Shift+Tab indentation, and auto-indent after brackets on Enter.
- Keyboard users can leave the editor with Esc followed by Tab. The interface says so.
- The readout bar shows the cursor line and column.

## Preview

- A sandboxed `iframe` with width presets of 320 px, 768 px and Fit. A drag handle resizes the split between editor and preview, and the split can be resized with the keyboard too.
- The preview runs automatically after a short debounce. A Run button and a Reload button are there as well.
- Output of the demo's `console` is mirrored into a small console panel.

## Toolbar

- Copy, for the current tab or all three.
- Reset, which restores the original code and clears the demo's stored data.
- Share link. The three sources are compressed with `CompressionStream` (deflate), encoded as base64url and put in the URL hash. Opening a shared link loads the code but does not run it. The visitor first sees a "Shared code" notice with a Run button.
- Download, which produces a single `.html` file with the CSS and JavaScript inline.
- Persistence. Edits are kept in IndexedDB per demo until Reset. A tab with unsaved changes carries a "modified" marker.

## Open in own window

Some APIs do not work inside a sandboxed or cross-origin iframe: the Notification permission prompt, the File System Access pickers, Document Picture-in-Picture, Web Bluetooth, WebUSB, WebHID, Web Serial, Payment Request, the Contact Picker and parts of WebAuthn. A demo that needs one of them declares `runsIn: window`. The toolbar then shows "Open in own window", which runs the current code as a top-level page on the preview origin. The in-frame preview shows the reason and the fallback instead of failing.

## How the runner receives code

The shell never runs demo code itself. It sends the code to the preview runner by `postMessage`. Each side checks the sender's origin. The runner rejects messages from shell versions it does not understand. The details of the message format are decided in stage 4. See the [[Security model]] for the isolation rules and the [[Architecture]] page for the deployment.
