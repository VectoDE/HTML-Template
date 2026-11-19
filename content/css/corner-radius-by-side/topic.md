---
title: Corner radius by side
number: 1
lede: Round the two corners of one side with a single declaration, in physical or in flow-relative terms, instead of writing two longhands.
spec: https://drafts.csswg.org/css-borders-4/
interface: CSSStyleDeclaration
mdn: https://developer.mozilla.org/en-US/docs/Web/CSS/border-radius
---

## What the side shorthands do

`border-radius` sets all four corners. The longhands such as `border-top-left-radius` set one corner. The side shorthands sit in between: each one sets the two corners that meet on one side of the box.

- `border-top-radius`, `border-right-radius`, `border-bottom-radius` and `border-left-radius` follow the physical sides of the box.
- `border-block-start-radius` and `border-block-end-radius` follow the block axis, so they move with `writing-mode`.
- `border-inline-start-radius` and `border-inline-end-radius` follow the inline axis, so they move with `direction` as well.

A value is a length or a percentage, the same as for the corner longhands. Use the logical forms when the layout has to work in both left-to-right and right-to-left text, and the physical forms when the shape is tied to the screen, for example a panel that is attached to the bottom edge.

## Support

These properties are new. Check the reference table for the browsers that ship them, and write the corner longhands next to them where older browsers matter. A browser that does not know a shorthand ignores the declaration and draws square corners.
