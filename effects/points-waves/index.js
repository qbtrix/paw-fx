// three.js
// The MIT License
// Copyright © 2010-2026 three.js authors
// https://github.com/mrdoob/three.js
//
// points-waves: a port of three.js' webgl_points_waves example, commit
// 2431a09f46f34c560bc8e44b33be0e567723d5b9 (r185, the revision this repo
// vendors), examples/webgl_points_waves.html. Both inline x-shader blocks are
// carried below verbatim; every constant is that file's -- SEPARATION 100,
// AMOUNTX 50, AMOUNTY 50, camera 75deg / near 1 / far 10000 at z 1000, the two
// crossed sines at 0.3 and 0.5 driving y by 50 and scale by 20, the 0.05
// camera easing and the 0.1 per-frame phase step.
//
// THE MECHANISM. A 50x50 grid of points sits on a plane. Two sines, one along
// each axis, drive both the y of every point and its gl_PointSize, so the
// surface undulates and the crests read as larger dots at the same time. The
// fragment shader discards anything outside a 0.475 radius of the point's own
// coordinate, which is what makes a square sprite a round dot with no texture
// -- this is the one Points example in the r185 set that needs no bundled art.
//
// WHAT DOES NOT PORT. `Stats` from three/addons/libs/stats.module.js is a dev
// FPS counter and is dropped, which matters because this repo vendors classic
// three.module.js with no addons: no addon survives into the port.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "../../vendor/three.module.js";

export const meta = {
  name: "points-waves",
  version: "1.0.0",
  category: "particles",
  needs: ["three"],
  license: "MIT",
  options: {
    amount: { type: "number", default: 50, description: "Points per axis; the field is amount squared. Upstream's AMOUNTX / AMOUNTY." },
    separation: { type: "number", default: 100, description: "World units between neighbouring points. Upstream's SEPARATION." },
    color: { type: "string", default: "#ffffff", description: "Dot colour. Upstream's uniform color, 0xffffff." },
    speed: { type: "number", default: 0.1, description: "Phase added to the sines each frame. Upstream's count += 0.1." },
    tilt: { type: "number", default: 700, description: "World units the camera sits above the plane at rest, so the field reads as a surface rather than a line seen edge-on. Upstream rests at 0." },
    cameraZ: { type: "number", default: 3200, description: "How far back the camera sits. Upstream's 1000, which puts the camera inside the grid; pulled back past the near edge so no row is a few units in front of the lens." },
  },
};

// examples/webgl_points_waves.html, script type="x-shader/x-vertex" #vertexshader
const VERTEX = `
			attribute float scale;

			void main() {

				vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );

				gl_PointSize = scale * ( 300.0 / - mvPosition.z );

				gl_Position = projectionMatrix * mvPosition;

			}
`;

// examples/webgl_points_waves.html, script type="x-shader/x-fragment" #fragmentshader
const FRAGMENT = `
			uniform vec3 color;

			void main() {

				if ( length( gl_PointCoord - vec2( 0.5, 0.5 ) ) > 0.475 ) discard;

				gl_FragColor = vec4( color, 1.0 );

			}
`;

const UPSTREAM = { amount: 50, separation: 100, color: "#ffffff", speed: 0.1, tilt: 700, cameraZ: 3200 };

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: style.css has already drawn a
  // receding dot plane, so leaving it alone is the finished section.
  if (!el || typeof el.querySelector !== "function" || reducedMotion()) return resting;
  const host = el.querySelector("[data-fx-canvas]") || el;

  const settings = { ...UPSTREAM, ...opts };
  let torn = false;
  let renderer = null;
  let geometry = null;
  let material = null;
  let camera = null;
  let scene = null;
  let particles = null;
  let observer = null;
  let count = 0;
  // Upstream reads the pointer against the window's half-size. A section is
  // not the window, so these are offsets from the section's own centre.
  let mouseX = 0;
  let mouseY = 0;

  const size = () => ({
    w: Math.max(1, host.clientWidth || el.clientWidth || 1),
    h: Math.max(1, host.clientHeight || el.clientHeight || 1),
  });

  const onPointerMove = (event) => {
    if (event.isPrimary === false) return;
    const rect = host.getBoundingClientRect();
    mouseX = event.clientX - (rect.left + rect.width / 2);
    mouseY = event.clientY - (rect.top + rect.height / 2);
  };

  const onResize = () => {
    if (torn || !renderer || !camera) return;
    const { w, h } = size();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  // Upstream's render(): ease the camera toward the pointer, rewrite both
  // attributes from the two sines, upload, draw, advance the phase.
  const render = () => {
    if (torn || !renderer) return;
    const { amount, speed, tilt } = settings;
    camera.position.x += (mouseX - camera.position.x) * 0.05;
    camera.position.y += ((tilt - mouseY) - camera.position.y) * 0.05;
    camera.lookAt(scene.position);

    const positions = particles.geometry.attributes.position.array;
    const scales = particles.geometry.attributes.scale.array;

    let i = 0, j = 0;

    for (let ix = 0; ix < amount; ix++) {
      for (let iy = 0; iy < amount; iy++) {
        positions[i + 1] = (Math.sin((ix + count) * 0.3) * 50) +
                        (Math.sin((iy + count) * 0.5) * 50);

        scales[j] = (Math.sin((ix + count) * 0.3) + 1) * 20 +
                        (Math.sin((iy + count) * 0.5) + 1) * 20;

        i += 3;
        j++;
      }
    }
    particles.geometry.attributes.position.needsUpdate = true;
    particles.geometry.attributes.scale.needsUpdate = true;

    renderer.render(scene, camera);

    count += speed;
  };

  // Upstream's init(), minus the Stats panel and the document-level container.
  const build = () => {
    const { amount, separation, color, cameraZ } = settings;
    const { w, h } = size();

    camera = new PerspectiveCamera(75, w / h, 1, 10000);
    camera.position.z = cameraZ;
    camera.position.y = settings.tilt;
    scene = new Scene();

    const numParticles = amount * amount;
    const positions = new Float32Array(numParticles * 3);
    const scales = new Float32Array(numParticles);

    let i = 0, j = 0;

    for (let ix = 0; ix < amount; ix++) {
      for (let iy = 0; iy < amount; iy++) {
        positions[i] = ix * separation - ((amount * separation) / 2); // x
        positions[i + 1] = 0; // y
        positions[i + 2] = iy * separation - ((amount * separation) / 2); // z

        scales[j] = 1;

        i += 3;
        j++;
      }
    }

    geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("scale", new BufferAttribute(scales, 1));

    material = new ShaderMaterial({
      uniforms: {
        color: { value: new Color(color) },
      },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
    });

    particles = new Points(geometry, material);
    scene.add(particles);

    // failIfMajorPerformanceCaveat is the contract's rule, not upstream's: a
    // software-rasterised WebGL context would run this at a few frames a
    // second, and the CSS resting state is the better answer there.
    renderer = new WebGLRenderer({ antialias: true, alpha: true, failIfMajorPerformanceCaveat: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(w, h);
    renderer.setAnimationLoop(render);
    host.appendChild(renderer.domElement);

    host.style.touchAction = "none";
    host.addEventListener("pointermove", onPointerMove);
    // Upstream listens on window's resize. A section can change size without
    // the window doing so, which a ResizeObserver is the only way to see.
    observer = new ResizeObserver(onResize);
    observer.observe(host);

    el.setAttribute("data-fx-live", "");
  };

  const teardown = () => {
    renderer?.setAnimationLoop(null);
    observer?.disconnect();
    observer = null;
    host.removeEventListener("pointermove", onPointerMove);
    geometry?.dispose();
    material?.dispose();
    if (renderer) {
      renderer.domElement.remove();
      renderer.dispose();
    }
    renderer = geometry = material = camera = scene = particles = null;
    count = 0;
    el.removeAttribute("data-fx-live");
  };

  try {
    build();
  } catch {
    // A refused context leaves the CSS resting plane exactly as it was.
    teardown();
  }

  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(settings, next);
      teardown();
      try { build(); } catch { teardown(); }
    },
    destroy() {
      torn = true;
      teardown();
    },
  };
}
