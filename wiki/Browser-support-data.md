No version number on the site is written by hand. Support data comes from two packages and is read again in the visitor's browser. The build that processes the data is planned for stage 2.

## Sources

- `@mdn/browser-compat-data` provides, per feature, the first version in Chrome, Edge, Firefox and Safari, on desktop and mobile, plus flags, prefixes and deprecation status.
- `web-features` provides the Baseline status of a feature and the year it reached it.

Both are dev dependencies. They are used when the site is built and are not part of what is shipped.

## At build time

The build writes a compact JSON file per topic and per demo. A demo lists the compat keys it exercises, and the build resolves each key to its versions and Baseline status. The spec plate at the top of a topic and the reference tables on the page are rendered from these files. The keys the build checks, and the exclusions, are described in [[Topic catalogue and coverage]].

## In the browser

Each demo declares a feature-detect expression. The readout bar evaluates it in the visitor's browser and shows a green, amber or red light, the browser and version, and the fallback note. The readout also says whether the page runs in a secure context, because many APIs need HTTPS.

## Keeping it current

A weekly automated update raises both packages, rebuilds the data and opens a pull request when the output changed. Dependabot or a scheduled workflow does this. A change in the data shows up as a diff in the generated files, so a reviewer can see which claims moved.

## Wrong data

If a support claim looks wrong, check the compat key in the upstream data first. Report upstream errors to the `mdn/browser-compat-data` project. If the site reads the data incorrectly, open an issue here.

Related pages: [[Architecture]], [[Writing a demo]].
