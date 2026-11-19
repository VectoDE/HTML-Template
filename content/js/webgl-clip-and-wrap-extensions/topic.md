---
title: WebGL clip control and mirror clamp
number: 1
lede: Two optional WebGL extensions change how clip space and texture wrapping work, so ported rendering code can keep its original conventions.
spec:
  - https://registry.khronos.org/webgl/extensions/EXT_clip_control/
  - https://registry.khronos.org/webgl/extensions/EXT_texture_mirror_clamp_to_edge/
interface: WebGLRenderingContext
mdn: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/Using_Extensions
---

## Optional extensions

WebGL keeps a small core and moves everything else into extensions. A page asks the context for one with `getExtension()`. The call returns `null` when the browser or the graphics driver does not offer it, so every use starts with a check.

- `EXT_clip_control` lets the page choose where clip space has its origin and how depth is mapped. Code written for Direct3D, Vulkan or Metal usually expects the origin at the upper left and depth from 0 to 1. Without the extension WebGL always uses the lower left and the range -1 to 1.
- `EXT_texture_mirror_clamp_to_edge` adds a wrap mode that mirrors the texture once around the edge and then clamps. It is useful for filters that sample just outside an image.

Both extensions depend on the device, not only on the browser version. Treat a missing extension as a normal case and keep a fallback path.
