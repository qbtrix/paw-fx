// bad-licence-mismatch: declares MIT over an Apache-2.0 upstream.
//
// The pin resolves and the port is import-only, so this fixture fails for the
// licence and nothing else. paper-design/shaders is Apache-2.0, and its NOTICE
// obligation under section 4(d) disappears the moment the meta says MIT.
//
// Copyright 2026 the upstream author. Licensed under MIT.
import { ShaderMount, meshGradientFragmentShader } from "../../vendor/paper.js";

export const meta = { name: "bad-licence-mismatch", version: "1.0.0", category: "backgrounds", needs: ["paper"], license: "MIT", options: {} };

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  const shader = new ShaderMount(el, meshGradientFragmentShader, {}, { failIfMajorPerformanceCaveat: true }, 1);
  return { update() {}, destroy() { shader.dispose(); } };
}
