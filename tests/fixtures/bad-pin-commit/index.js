// bad-pin-commit: the sha is invented.
//
// Everything else about this effect is correct. The commit is 40 hex
// characters that GitHub has never heard of, which is the single most likely
// shape a fabricated origin takes.
//
// Copyright 2026 the upstream author. Licensed under Apache-2.0.
import { ShaderMount, meshGradientFragmentShader } from "../../vendor/paper.js";

export const meta = { name: "bad-pin-commit", version: "1.0.0", category: "backgrounds", needs: ["paper"], license: "Apache-2.0", options: {} };

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  const shader = new ShaderMount(el, meshGradientFragmentShader, {}, { failIfMajorPerformanceCaveat: true }, 1);
  return { update() {}, destroy() { shader.dispose(); } };
}
