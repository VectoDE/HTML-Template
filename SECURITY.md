# Security policy

## Supported versions

| Version                         | Supported |
| ------------------------------- | --------- |
| Latest pre-release of 1.0.0     | Yes       |
| Latest 1.x (after 1.0.0 is out) | Yes       |
| Anything older                  | No        |

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private vulnerability reporting instead:

<https://github.com/VectoDE/HTML-Template/security/advisories/new>

Include what you found, the steps to reproduce it, the affected page or file, and the browser and version you tested in. A working proof of concept helps but is not required.

## What to expect

This project has a single maintainer, so the times below are targets, not guarantees.

- Acknowledgement of your report within 7 days.
- A status update within 14 days.
- A fix or a mitigation within 90 days. If a fix needs longer, you get the reason and a new date.

Once a fix is released, the advisory is published and credits you, unless you prefer to stay anonymous.

## Scope

In scope:

- The site shell (the pages served from GitHub Pages), including its Content Security Policy, the service worker and the editor.
- The preview runner, which is served from a separate origin and renders demo code received through `postMessage`. Examples: accepting messages from the wrong origin, a way for demo code to reach the shell's storage or caches, or an escape from the iframe sandbox.
- The Cloudflare Worker that acts as the counterpart for network demos. Examples: missing rate limiting, an open CORS policy, stored data, or forwarding requests to other hosts.
- The build scripts and GitHub Actions workflows in this repository.

Out of scope:

- Code that a visitor types into the editor and runs in the preview. Running arbitrary code there is the purpose of the site. A report is in scope only if that code can affect anything outside the preview origin.
- Browser bugs. Report those to the browser vendor.
- Findings that need a modified browser, a malicious extension or physical access to the device.
- Automated scanner output without a demonstrated impact.

## Demo code isolation

Demos run on a separate origin from the shell, inside a sandboxed iframe, so they cannot read the shell's IndexedDB or service worker caches. The Worker stores nothing and answers only the shell and preview origins. A way around any of this is a vulnerability and belongs in a private report.
