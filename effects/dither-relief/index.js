// Dithering - Part 1
// MIT License
// Copyright (c) 2026 by damarberlari (https://codepen.io/damarberlari/pen/pvgKamj)
//
// dither-relief: a port of damarberlari's "Dithering - Part 1", pinned by
// snapshot rather than by commit -- a pen has no revision history, so the copy
// this was ported from is committed at
// tests/fixtures/upstream-snapshots/damarberlari-pvgKamj.snapshot.txt and the
// gate hashes it.
//
// THE MECHANISM. A picture is rebuilt as a grid of small 3D boxes, one per
// pixel of a downsampled read of the texture. Each box asks the vertex shader
// for its own cell's luminance, compares it against a 4x4 Bayer ordered-dither
// threshold, and uses the answer twice: to pick its colour, and -- through
// uGridOffsetStart/End and uCellScaleStart/End -- to set how far it stands
// proud of the plane. So the image starts as continuous-tone relief and
// resolves into hard two-tone dither as uAnimationProgress sweeps 0 to 1, cell
// by cell, because each cell's own `animationDelay` is its index through the
// grid.
//
// NOT NAMED `dithering`. That name is taken by a Paper Shaders background which
// does 2D ordered dither over a procedural sphere. This is instanced geometry
// relieving a photograph in perspective: same 4x4 Bayer look, different
// technique, different input, different shelf.
//
// ANIME IS ALREADY UPSTREAM'S. The pen imports `createTimeline` and `animate`
// from animejs and uses no GSAP at all, so every duration, easing and sync
// offset below is upstream's verbatim -- 10000ms inOutCubic camera pan, 10000ms
// zoom, 15000ms linear progress sweeps at +500 and "<<+=660". The only change
// is the import path.
//
// UPSTREAM'S SECOND PANEL IS DROPPED. The pen is an explainer for an article:
// it renders the image grid AND, beneath it, a second grid (gridType 2) showing
// the bare Bayer threshold map, as a teaching diagram. A drop-in section is not
// a diagram, so only the image panel ships. GRID_TYPE 2 and 0 are gone from the
// vertex shader with them; type 1 is carried verbatim.
//
// NO PHOTOGRAPH SHIPS. Upstream embeds a portrait as a ~115 KB base64 JPEG,
// which is content under separate rights, not mechanism -- the shader samples
// whatever texture it is handed. The snippet points at a generated SVG plate
// and a site swaps one attribute for its own picture. The slot has to stay a
// real <img>: its pixels ARE the input, so it cannot be a CSS background.
import {
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  OrthographicCamera,
  BoxGeometry,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  WebGLRenderer,
} from "../../vendor/three.module.js";
import { animate, createTimeline } from "../../vendor/anime.esm.js";

export const meta = {
  name: "dither-relief",
  version: "1.0.0",
  category: "gallery",
  needs: ["three", "anime"],
  license: "MIT",
  options: {
    resolution: {
      type: "number",
      default: 256,
      description: "Cells per side. Upstream's rows/columns of 256, which is 65536 boxes. Drop it to 128 on a page carrying several heavy sections.",
    },
    ground: {
      type: "string",
      default: "#F9C939",
      description: "Scene background behind the relief. Upstream's flat yellow #F9C939.",
    },
    relief: {
      type: "number",
      default: 16,
      description: "How far a cell stands proud of the plane at the start, in scene units. Upstream's uGridOffsetStart 16, sweeping to its negation.",
    },
  },
};

// Upstream's Grid gridProperties and its initial uniform writes.
const UPSTREAM = { resolution: 256, ground: "#F9C939", relief: 16 };

// Upstream's own animation numbers, unchanged.
const PAN_DURATION = 10000;
const SWEEP_DURATION = 15000;
const SWEEP_OFFSET = 500;
const CAMERA_ZOOM_START = 12;
const CAMERA_ZOOM_END = 0.9;
const ANCHOR_START = { x: -124, y: 124 };
const ANCHOR_ROT_Y = Math.PI * 0.2;
const ANCHOR_ROT_X = -Math.PI * 0.15;
const BOUNDING_BOX = 256;

// The pen's vertex shader, GRID_TYPE hard-wired to 1 (Image Mode) because the
// threshold-map panel that used types 0 and 2 does not ship. Every other line,
// including the Bayer matrix and both smoothstep windows, is upstream's.
const VERTEX = `
      uniform float uRowSize;
      uniform float uColumnSize;
      uniform float uAnimationProgress;
      uniform float uGridOffsetStart;
      uniform float uGridOffsetEnd;
      uniform float uCellScaleStart;
      uniform float uCellScaleEnd;
      uniform sampler2D uTexture;

      attribute float aRow;
      attribute float aColumn;

      varying vec3 vColor;
      varying vec3 vNormal;

      float bayer4x4(vec2 coord) {
      ivec2 iCoord = ivec2(mod(coord, 4.0));
      const mat4 bayer = mat4(
          vec4(0.0 / 16.0, 12.0 / 16.0, 3.0 / 16.0, 15.0 / 16.0),
          vec4(8.0 / 16.0, 4.0 / 16.0, 11.0 / 16.0, 7.0 / 16.0),
          vec4(2.0 / 16.0, 14.0 / 16.0, 1.0 / 16.0, 13.0 / 16.0),
          vec4(10.0 / 16.0, 6.0 / 16.0, 9.0 / 16.0, 5.0 / 16.0)
          );
      return bayer[iCoord.y][iCoord.x];
      }

      mat3 scale(vec3 _scale){
          return mat3(_scale.x, 0.0, 0.0,
                  0.0, _scale.y, 0.0,
                  0.0, 0.0, _scale.z);
      }

      void main() {
        vec2 st = vec2(aColumn, uRowSize - 1.0 - aRow) / vec2(uColumnSize - 1.0, uRowSize - 1.0);
        float bayerThreshold = bayer4x4(vec2(aColumn, aRow));

        vec4 textureColor = texture2D(uTexture, st);
        float initialColor = textureColor.r;
        float borderWidth = 2.0;

        float cellIndex = ((aRow * uColumnSize) + aColumn) / (uRowSize * uColumnSize);
        float animationDelay = cellIndex * 0.9;
        float animationDuration = 0.1;
        float animationEnd = animationDelay + animationDuration;
        float animationProgress = smoothstep(animationDelay, animationEnd, uAnimationProgress);

        float cellOffset = mix(uGridOffsetStart, uGridOffsetEnd, animationProgress);
        float cellScale = mix(uCellScaleStart, uCellScaleEnd, animationProgress );
        cellScale = max(cellScale, 0.0);

        float ditheredColor = step(bayerThreshold, initialColor);
        float ditherProgress = smoothstep(0.48, 0.6, animationProgress);
        float finalColor = mix(initialColor, ditheredColor, ditherProgress);

        //Check if border
        float isBorder = clamp(
          step(aColumn + 0.1, borderWidth) +
          step(uColumnSize - borderWidth, aColumn) +
          step(aRow + 0.1, borderWidth) +
          step(uRowSize - borderWidth, aRow),
        0.0, 1.0);

        //Change color to black if isBorder
        finalColor *= (1.0 - isBorder);

        vec4 cellLocalPosition = vec4(position, 1.0);
        cellLocalPosition.xyz *= scale(vec3(cellScale));

        vec4 cellPosition = modelMatrix * instanceMatrix * cellLocalPosition;
        cellPosition.z += cellOffset;

        vec4 modelNormal = modelMatrix * instanceMatrix * vec4(normal, 0.0);

        gl_Position = projectionMatrix * viewMatrix * cellPosition;
        vColor = vec3(finalColor);
        vNormal = normalize(modelNormal.xyz);
      }
`;

// The pen's fragment shader, byte for byte.
const FRAGMENT = `
        varying vec3 vColor;
        varying vec3 vNormal;

        void main() {
        float shadow = dot(normalize(vec3(0.0, 0.0, 1.0)), vNormal);
        vec3 color = vColor * (0.9 + 0.1 * shadow);
        gl_FragColor = vec4(color, 1.0);

        }
`;

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const num = (value, fallback, min, max) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof el.querySelector !== "function") return resting;

  const stage = el.querySelector(".fx-dither__stage");
  const source = el.querySelector(".fx-dither__img");
  if (!stage || !source) return resting;

  // Stillness means the picture, whole and legible, which is what the
  // stylesheet already draws. The sweep is the only thing dropped.
  if (reducedMotion()) return resting;

  const settings = {
    resolution: Math.round(num(opts.resolution, UPSTREAM.resolution, 8, 512)),
    ground: typeof opts.ground === "string" ? opts.ground : UPSTREAM.ground,
    relief: num(opts.relief, UPSTREAM.relief, 0, 200),
  };

  let renderer = null;
  let scene = null;
  let camera = null;
  let anchor = null;
  let mesh = null;
  let geometry = null;
  let material = null;
  let texture = null;
  let timeline = null;
  let ro = null;
  let torn = false;

  // Every failure path -- no WebGL, a context refused for a major performance
  // caveat, a context lost after mount -- lands here and leaves the section as
  // the stylesheet drew it: the photograph, visible.
  const bail = () => {
    try { timeline?.pause(); } catch { /* never started */ }
    timeline = null;
    try { renderer?.forceContextLoss(); } catch { /* extension unavailable */ }
    try { renderer?.dispose(); } catch { /* nothing to dispose */ }
    renderer?.domElement?.remove();
    renderer = null;
    el.removeAttribute("data-fx-live");
    return resting;
  };

  let canvas;
  try {
    // Upstream reads a <canvas class="webgl"> out of its own page. A section
    // owns its canvas, so this mount makes one -- and asks for a real GPU:
    // 65536 instanced boxes on a software rasteriser is a slideshow, and the
    // photograph underneath is the better answer.
    renderer = new WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      failIfMajorPerformanceCaveat: true,
    });
    canvas = renderer.domElement;
    canvas.classList.add("fx-dither__canvas");
    stage.appendChild(canvas);

    scene = new Scene();
    scene.background = new Color(settings.ground);

    camera = new OrthographicCamera();
    camera.position.set(0, 0, 130);
    camera.lookAt(0, 0, 0);
    camera.near = 0.01;
    camera.far = 1000;

    anchor = new Group();
    anchor.name = "cameraAnchor";
    anchor.add(camera);
    scene.add(anchor);
  } catch {
    return bail();
  }

  // Grid.calculateCellProperties + Grid.init, for one grid of gridType 1.
  const rows = settings.resolution;
  const columns = settings.resolution;
  const spacing = 1;
  const cellSize = 1;
  const count = rows * columns;

  const aRow = new Float32Array(count);
  const aColumn = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    aRow[i] = Math.floor(i / columns);
    aColumn[i] = i % columns;
  }

  geometry = new BoxGeometry(1, 1, 1);
  geometry.setAttribute("aRow", new InstancedBufferAttribute(aRow, 1));
  geometry.setAttribute("aColumn", new InstancedBufferAttribute(aColumn, 1));

  material = new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uRowSize: { value: rows },
      uColumnSize: { value: columns },
      uGridOffsetStart: { value: settings.relief },
      uGridOffsetEnd: { value: -settings.relief },
      uCellScaleStart: { value: 1 },
      uCellScaleEnd: { value: 1 },
      uTexture: { value: null },
      uAnimationProgress: { value: 0 },
    },
  });

  mesh = new InstancedMesh(geometry, material, count);
  const group = new Group();
  group.add(mesh);

  const dummy = new Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(
      (aColumn[i] - (columns - 1) / 2) * spacing,
      (-aRow[i] + (rows - 1) / 2) * spacing,
      0,
    );
    dummy.scale.set(cellSize, cellSize, cellSize);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(group);

  // The picture is the <img> in the section, not a URL baked into this file.
  texture = new TextureLoader().load(source.currentSrc || source.src, (tex) => {
    tex.colorSpace = SRGBColorSpace;
    material.uniforms.uTexture.value = tex;
    material.needsUpdate = true;
  });

  // Upstream's initial camera state.
  camera.zoom = CAMERA_ZOOM_START;
  camera.updateProjectionMatrix();
  anchor.rotation.reorder("YXZ");
  anchor.rotation.y = ANCHOR_ROT_Y;
  anchor.rotation.x = ANCHOR_ROT_X;
  anchor.position.set(ANCHOR_START.x, ANCHOR_START.y, 0);

  // Upstream's resize(), measured against the section's own box rather than
  // the window's -- the same number when the section fills the page and the
  // right one when it does not. It re-renders before returning, because
  // setSize clears the drawing buffer and this effect only paints on a
  // timeline tick: without it a resize between ticks leaves an empty canvas.
  const resize = () => {
    if (torn || !renderer) return;
    const box = stage.getBoundingClientRect();
    const width = Math.max(1, box.width);
    const height = Math.max(1, box.height);
    const aspectRatio = width / height;

    if (aspectRatio < 1) {
      camera.left = -BOUNDING_BOX / 2;
      camera.right = BOUNDING_BOX / 2;
      camera.top = BOUNDING_BOX / 2 / aspectRatio;
      camera.bottom = -BOUNDING_BOX / 2 / aspectRatio;
    } else {
      camera.left = -BOUNDING_BOX / 2 * aspectRatio;
      camera.right = BOUNDING_BOX / 2 * aspectRatio;
      camera.top = BOUNDING_BOX / 2;
      camera.bottom = -BOUNDING_BOX / 2;
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.render(scene, camera);
  };

  const onContextLost = (e) => {
    e.preventDefault();
    bail();
  };
  canvas.addEventListener("webglcontextlost", onContextLost);

  resize();
  ro = typeof ResizeObserver === "function" ? new ResizeObserver(() => resize()) : null;
  ro?.observe(stage);

  // Upstream's timeline, verbatim: a looping timeline whose onUpdate is the
  // render, a 10s inOutCubic pan of the camera anchor back to the origin, a 10s
  // zoom out to 0.9 synced at 0, and the 15s linear progress sweep synced at
  // 500ms. Upstream's second sweep, at "<<+=660", drove the threshold-map panel
  // that does not ship here.
  timeline = createTimeline({
    loop: true,
    onUpdate: () => {
      if (!torn && renderer) renderer.render(scene, camera);
    },
  });

  timeline.sync(
    animate(anchor.position, {
      x: 0,
      y: 0,
      duration: PAN_DURATION,
      ease: "inOutCubic",
    }),
    0,
  );

  timeline.sync(
    animate(camera, {
      zoom: CAMERA_ZOOM_END,
      duration: PAN_DURATION,
      composition: "none",
      onUpdate: () => { camera.updateProjectionMatrix(); },
    }),
    0,
  );

  timeline.sync(
    animate(material.uniforms.uAnimationProgress, {
      value: 1,
      duration: SWEEP_DURATION,
      ease: "linear",
    }),
    SWEEP_OFFSET,
  );

  // data-fx-live fades the source <img> down. It is set only once the renderer
  // exists and the grid is on screen, so a refused context leaves the
  // photograph where it is instead of an empty box.
  el.setAttribute("data-fx-live", "");

  return {
    update(next = {}) {
      if ("ground" in next && typeof next.ground === "string" && scene) {
        settings.ground = next.ground;
        scene.background = new Color(settings.ground);
      }
      if ("relief" in next && material) {
        settings.relief = num(next.relief, UPSTREAM.relief, 0, 200);
        material.uniforms.uGridOffsetStart.value = settings.relief;
        material.uniforms.uGridOffsetEnd.value = -settings.relief;
      }
      // resolution rebuilds 65536 instances, so it is a mount-time choice.
    },
    destroy() {
      torn = true;
      try { timeline?.pause(); } catch { /* never started */ }
      timeline = null;
      canvas?.removeEventListener("webglcontextlost", onContextLost);
      ro?.disconnect();
      ro = null;
      texture?.dispose();
      geometry?.dispose();
      material?.dispose();
      try { renderer?.forceContextLoss(); } catch { /* extension unavailable */ }
      try { renderer?.dispose(); } catch { /* already gone */ }
      renderer?.domElement?.remove();
      renderer = null;
      scene = null;
      el.removeAttribute("data-fx-live");
    },
  };
}
