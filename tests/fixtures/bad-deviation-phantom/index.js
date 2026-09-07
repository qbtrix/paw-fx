// bad-deviation-phantom: a clean port with a deviation that describes nothing.
//
// The pin resolves, the licence agrees, the port is import-only. The only
// thing wrong is the declared deviation: nothing in this file mentions a
// composite step or a chromatic aberration pass, so the entry is either stale
// or written to look diligent. That is a WARN and not a FAIL, because prose
// can be right and worded so it shares no token with the code.
//
// Copyright 2026 Paper. Licensed under the Apache License, Version 2.0.
import { ShaderMount, meshGradientFragmentShader } from "../../vendor/paper.js";

export const meta = { name: "bad-deviation-phantom", version: "1.0.0", category: "backgrounds", needs: ["paper"], license: "Apache-2.0", options: {} };

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  const shader = new ShaderMount(el, meshGradientFragmentShader, {}, { failIfMajorPerformanceCaveat: true }, 1);
  return { update() {}, destroy() { shader.dispose(); } };
}
