// bad-pin-path: the commit is real, the file is not.
//
// A shader name that sounds like it belongs in the upstream package and does
// not exist there. The commit resolves, so only a per-path fetch catches it.
//
// Copyright 2026 the upstream author. Licensed under Apache-2.0.
import { ShaderMount, meshGradientFragmentShader } from "../../vendor/paper.js";

export const meta = { name: "bad-pin-path", version: "1.0.0", category: "backgrounds", needs: ["paper"], license: "Apache-2.0", options: {} };

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  const shader = new ShaderMount(el, meshGradientFragmentShader, {}, { failIfMajorPerformanceCaveat: true }, 1);
  return { update() {}, destroy() { shader.dispose(); } };
}
