The site lets visitors edit and run code, so the main question is where that code runs. This page states the rules. The implementation is planned for stages 3 and 4. Nothing described as planned exists yet.

## Shell and preview are separate origins (planned)

The shell is hosted on GitHub Pages. The preview runner is a separate page on Cloudflare Pages, so it has a different origin. Everything a visitor types runs there, never on the shell origin.

This matters because all `github.io` project pages share one origin. Code running on it could read the shell's IndexedDB, where edits and settings are kept, and its service worker caches. On a separate origin it cannot.

The runner serves a small fixed page. It receives the demo code from the shell by `postMessage`, and both sides check the origin of the sender. The runner rejects messages from shell versions it does not understand.

Preview iframes use `sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"`. `allow-same-origin` is safe here only because the frame's origin is the preview origin. The `allow` attribute lists just the permission features the demo declares. Each demo has its own storage namespace on the preview origin, and Reset clears it.

## Demos that need their own window (planned)

Notifications, the File System Access pickers, Document Picture-in-Picture, Web Bluetooth, WebUSB, WebHID, Web Serial, Payment Request, the Contact Picker and parts of WebAuthn do not work in a sandboxed iframe. These demos open the current code as a top-level page on the preview origin, which stays isolated from the shell. The in-frame view shows the reason and the fallback.

## Shared links never run by themselves

A share link carries the code in the URL hash. Opening one loads the code into the editor and asks for confirmation. Nothing runs until the visitor presses Run. This applies to every link, including those that look like they come from this site.

## Content Security Policy

The shell's policy has no `unsafe-inline` and no `unsafe-eval`. `frame-src` allows only the preview origin and `connect-src` allows only `'self'`. The shell loads no third-party scripts, fonts or analytics.

The runner has a looser policy because demos need inline scripts and `eval`. That is acceptable because it applies to the preview origin only. Its `connect-src` allows the Worker origin and whatever a demo legitimately needs. The exact policy is documented here when the runner is built.

## The demo Worker (planned)

The Worker is the counterpart for network demos such as WebSocket, Server-Sent Events, Push and WebAuthn. It is stateless and stores nothing. It is rate-limited per IP, and CORS is allowed only for the shell and preview origins. Push is sent only to the subscription the visitor has just created. WebAuthn challenges are signed and short-lived, not stored. If the Worker is unreachable, demos switch to an in-browser simulation and say so.

## Permission prompts

Camera, microphone, location, notifications and similar prompts appear only after a click on an explicit button. A demo never asks on load.

## Reporting a problem

Do not open a public issue for a vulnerability. Follow `SECURITY.md` in the repository. See also the [[Architecture]] page and the [[Testing guide]] for the isolation tests.
