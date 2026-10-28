## Why is there no site yet?

The project is being rebuilt from scratch. Stage 1 sets up the repository, the checks and the release pipeline. The shell comes in stage 3 and the first topics in stage 5. See the [[Roadmap]].

## Why no framework?

The shipped site has no runtime dependencies. The editor, the search and the build are written for this project, so the output is plain HTML, CSS and JavaScript that you can read and copy. Dev dependencies are allowed when there is a stated reason.

## Can I run my own code on the site?

Yes, in the editor. Your code runs on a separate preview origin, so it cannot touch the data the site stores. See the [[Security model]].

## Why does a demo ask me to press a button before it uses my camera?

A demo that needs a permission asks for it only after you click its button, never when the page loads. If you deny the request, the demo shows what happens in that case.

## A demo says my browser does not support a feature. Is that right?

The note comes from the browser's own feature detection, combined with version data from MDN's browser-compat-data. If both look wrong, open an issue with your browser and version. See [[Browser support data]].

## Why is my favourite feature missing?

Either it is not covered yet or it is on the exclusion list with a reason. The rules are on [[Topic catalogue and coverage]]. Open an issue with the feature name if you think it should be there.

## Are there translations?

No. The site is in English only.

## How do I report a security problem?

Do not use a public issue. Follow `SECURITY.md` in the repository.

## How do I know a release is genuine?

Verify its signature and provenance. The commands are on [[Release process]].

## How do I contribute?

Read `CONTRIBUTING.md` and [[Writing a demo]]. Commits need a sign-off (`git commit -s`).
