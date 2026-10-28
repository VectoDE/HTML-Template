The shell targets WCAG 2.2 level AA. Demos are held to the same standard, because a reference that teaches inaccessible patterns does harm. The shell is not built yet, so this page states the bars it has to meet and how they will be checked.

## Shell

- Everything works with the keyboard: the topic tree, the demo tabs, the editor, the split handle and the command palette.
- Focus is always visible and never trapped, apart from the modal palette, which returns focus to its opener when it closes.
- The page has landmarks (header, navigation, main, footer) and one `h1`.
- Running, copying and resetting a demo announce their result through a live region.
- Forced-colors mode and `prefers-reduced-motion` are supported. Motion is limited to opening the palette and feedback while a panel is resized.
- Text and interface contrast meet AA in light and dark themes. Syntax highlighting colours do too.
- The layout works at 375 px without horizontal scroll, and with the browser zoomed to 200 percent.

## Editor

The editing surface keeps native undo, selection, IME input and screen-reader editing. Esc followed by Tab leaves the editor, and the interface tells keyboard users so. The split between editor and preview can be moved with the keyboard.

## Demos

- Use the native element first and ARIA only where HTML cannot express the role or state.
- Every control has a visible label or an accessible name.
- Errors are shown in text, linked to the field, and announced.
- Motion respects `prefers-reduced-motion`.
- Each demo that needs a note about accessibility states it in its meta block. See [[Writing a demo]].

## How it is checked

axe-core runs inside Playwright against every page of the shell. Lighthouse CI covers the home page and a sample of topic pages. Keyboard paths and screen-reader behaviour are checked by hand before a release, because automated tools find only part of the problems. Details of the tools are in the [[Testing guide]].

If you find a barrier, open an issue. It will be handled as a bug.
