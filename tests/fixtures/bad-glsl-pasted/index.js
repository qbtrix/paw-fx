// bad-glsl-pasted: a paper-design port with its own GLSL in index.js.
//
// The rule for this upstream is import-only: the shader string comes from
// vendor/paper.js, so there is no second copy that can drift. A file that
// writes its own fragment source has left the pinned shader behind entirely,
// whatever the origin says. Every number below is 0 or 1 on purpose, so this
// fixture fails for the pasted GLSL and for nothing else.
//
// Copyright 2026 Paper. Licensed under the Apache License, Version 2.0.
import { ShaderMount } from "../../vendor/paper.js";

export const meta = { name: "bad-glsl-pasted", version: "1.0.0", category: "backgrounds", needs: ["paper"], license: "Apache-2.0", options: {} };

const FRAGMENT = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  gl_FragColor = vec4(uv.x, uv.y, 1.0, 1.0);
}
`;

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  const shader = new ShaderMount(el, FRAGMENT, {}, { failIfMajorPerformanceCaveat: true }, 1);
  return { update() {}, destroy() { shader.dispose(); } };
}
