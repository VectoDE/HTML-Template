HTML-Template is an interactive reference for HTML, CSS and JavaScript. You look up a feature, see it running, edit the code in the browser and copy the result into your own project. Every demo shows the modern form of the feature together with the parts real projects need: accessibility, error handling and a fallback for browsers that lack it. The site is in English only.

The project is being rebuilt in seven stages. Stage 1 is the repository, the CI, the signed release pipeline and this wiki. Stage 2 is the build pipeline, the extraction of browser support data and the coverage check. The shell, the editor and the topic pages come in later stages, so some pages here describe the design and say which parts exist so far. The [[Roadmap]] lists what each stage delivers.

## Where to start

- To run the repository locally, read [[Getting started]].
- To see how the pieces fit together, read [[Architecture]] and the [[Security model]].
- To contribute a demo, read [[Writing a demo]] and [[Topic catalogue and coverage]].
- To check a release you downloaded, read [[Release process]].
- For quick answers, see the [[FAQ]].

## Status

The repository holds the policy checks, the CI workflows, the OpenSSF configuration, the release pipeline, the build that writes the static site to `dist/site`, and the coverage check. There is no deployed site yet. Stage 3 builds the shell next. The first signed pre-release, `1.0.0-alpha.1`, shipped with stage 1. Version 1.0.0 is published once every topic is done.

The source code is licensed under the MIT License. The repository is at https://github.com/VectoDE/HTML-Template.
