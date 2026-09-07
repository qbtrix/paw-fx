// Ported from "three.js" examples, MIT License, Copyright (c) 2010-2024 three.js authors.
// fixture: the header shape ports carry, next to a real vendor import. Pins
// both sides -- lint accepts the header, and the build neither misreads the
// comment as a module specifier nor forgets to emit three's second file and
// its licence file.
import * as THREE from "../../vendor/three.module.js";

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  const scene = new THREE.Scene();
  el.setAttribute("data-fx-live", "");
  return { update() {}, destroy() { void scene; el.removeAttribute("data-fx-live"); } };
}
