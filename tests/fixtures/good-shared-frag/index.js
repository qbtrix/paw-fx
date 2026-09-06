// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2026 fixture author
// fixture: the shape the shader.gallery ports carry -- GLSL beside index.js as
// its own byte-identical file, plus a shared runtime out of effects/_shared/.
// Pins both halves of the build: the .frag is emitted, and so is the shared
// file, at the path the relative import resolves to inside a site.
import { mountStub } from "../_shared/stub-mount.js";

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  void new URL("./shader.frag", import.meta.url);
  return mountStub(el);
}
