// glsl2-mount: the WebGL2 runtime the Solace ports share.
//
// New file. Not an effect -- effects/_shared/ is skipped by effectDirs(), and
// build-registry copies this file into every item whose index.js imports it.
//
// WHY A SECOND RUNTIME. glsl-mount.js pairs its fragment shader with a GLSL ES
// 1.00 vertex shader (`attribute`, `gl_FragColor`, no #version). Every Solace
// shader is `#version 300 es`, and the two cannot link -- the same wall that
// file hit from the other side when shader.gallery's ES 1.00 shaders were run
// through paper's ES 3.00 mount. Rather than teach one runtime both dialects
// and risk the nineteen effects already shipping on it, this is a sibling:
// same lifecycle discipline, same bail(), different dialect and a wider
// uniform set. glsl-mount.js is not touched by this file's existence.
//
// WHAT IT CARRIES that the ES 1.00 runtime does not, measured off the ports
// rather than guessed: typed uniforms (float, vec2, vec3 and int -- a float
// call on an int uniform is a GL error, not a silent no-op), one or two image
// textures with their aspect, and a pointer in 0..1 uv with an eased strength
// so a shader can fade its interaction in and out rather than snapping.
//
// WHAT IT DOES NOT CARRY. No framebuffers and no ping-pong: two of the Solace
// shaders are multi-pass (a heat buffer, and an eight-pass fluid solver) and
// belong to a runtime that owns render targets. No gl.POINTS pipeline either,
// which is what particle-morph draws. Both are declared out of scope here so
// the next reader does not go looking for support that was never written.
//
// Failure is always the same exit: no WebGL2, a context refused for a major
// performance caveat, a 404 on the .frag, a shader that will not compile, an
// image that will not load, a context lost later -- all land in bail(), which
// tears the canvas down and leaves the section showing the CSS resting state
// it was already showing.

// Upstream's own vertex shader, which every Solace fragment shader is written
// against: it hands on v_uv in 0..1 and nothing else.
const VERT = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() { v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }`;

const MAX_DPR = 2; // a 4K hero at dpr 3 is 24M fragments a frame for no visible gain

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** "#abc", "#aabbcc" or a computed "rgb(r, g, b)" to 0..1 rgb. */
export function rgb(value, fallback = [0, 0, 0]) {
  const s = String(value ?? "").trim();
  const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const h = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  const nums = s.match(/^rgba?\(([^)]+)\)$/i)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return nums && nums.length >= 3 ? nums.slice(0, 3).map((n) => n / 255) : fallback;
}

/** One colour option, else the --fx-c<n> custom property on the section, else the port's default. */
export function colorFor(el, value, cssVar, fallback) {
  if (value) return rgb(value, rgb(fallback));
  const own = getComputedStyle(el).getPropertyValue(cssVar).trim();
  return rgb(own, rgb(fallback));
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return sh;
  gl.deleteShader(sh);
  return null;
}

/**
 * @param el          the section. The canvas is prepended into it.
 * @param shaderUrl   the .frag beside the effect's index.js, fetched not inlined.
 * @param opts.uniforms  { name: number | [x,y] | [x,y,z] } -- set every frame.
 * @param opts.ints      { name: integer } -- kept apart because the call differs.
 * @param opts.textures  { samplerName: url } -- 0, 1 or 2. The first one's
 *                       aspect is published as u_sourceAspect.
 * @param opts.pointer   true to track the pointer as u_pointer / u_pointerStrength.
 */
export function mountGlsl2(el, shaderUrl, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof WebGL2RenderingContext === "undefined") return resting;

  const state = {
    uniforms: { ...opts.uniforms },
    ints: { ...opts.ints },
    textures: { ...opts.textures },
  };
  let torn = false;
  let gl = null;
  let program = null;
  let buffer = null;
  let canvas = null;
  let ro = null;
  let io = null;
  let raf = null;
  let start = 0;
  let visible = true;
  let aspect = 1;
  const texUnits = new Map(); // sampler name -> { unit, tex }
  const locs = new Map();

  // Upstream's pointer model, kept exactly: a target in 0..1 with y FLIPPED,
  // an eased follower at 0.09 a frame, and a velocity that is the follower's
  // own per-frame delta. The easing is the effect -- the dye trails and the
  // wakes are all driven off how far the follower is lagging the cursor -- so
  // a snapped pointer would quietly change what these shaders look like.
  //
  // Two names, because the shaders disagree: u_mouse is the flipped follower
  // the field shaders read, u_pointer the unflipped one the grid reads. A
  // shader declares one, and the location of the other is null and its call a
  // no-op, so both can be published every frame for nothing.
  const pointer = { tx: 0.5, ty: 0.5, x: 0.5, y: 0.5, px: 0.5, py: 0.5, strength: 0, target: 0 };

  const bail = () => {
    if (torn) return;
    torn = true;
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    ro?.disconnect();
    io?.disconnect();
    canvas?.removeEventListener("webglcontextlost", bail);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerenter", onEnter);
    el.removeEventListener("pointerleave", onLeave);
    if (gl) {
      for (const { tex } of texUnits.values()) gl.deleteTexture(tex);
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      // Releasing the context is the point: a page with several heroes on it
      // hits the browser's 8-16 live context ceiling otherwise, and the
      // oldest context is killed rather than this one.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    texUnits.clear();
    canvas?.remove();
    el.removeAttribute("data-fx-live");
  };

  // An unused uniform is stripped by the compiler and its location is null,
  // which every gl.uniform* call treats as a silent no-op -- that is what lets
  // one uniform set serve shaders that each declare a different subset.
  const loc = (name) => {
    if (!locs.has(name)) locs.set(name, gl.getUniformLocation(program, name));
    return locs.get(name);
  };

  const setUniforms = () => {
    for (const [name, value] of Object.entries(state.uniforms)) {
      if (typeof value === "number") gl.uniform1f(loc(name), value);
      else if (Array.isArray(value) && value.length === 2) gl.uniform2f(loc(name), value[0], value[1]);
      else if (Array.isArray(value) && value.length === 3) gl.uniform3f(loc(name), value[0], value[1], value[2]);
    }
    // Separate call, separate map: uniform1f against an `int` uniform raises
    // INVALID_OPERATION and the value never lands.
    for (const [name, value] of Object.entries(state.ints)) gl.uniform1i(loc(name), value | 0);
  };

  const onMove = (e) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    pointer.tx = (e.clientX - r.left) / r.width;
    pointer.ty = 1 - (e.clientY - r.top) / r.height;
  };
  const onEnter = () => { pointer.target = 1; };
  const onLeave = () => { pointer.target = 0; };

  const resize = () => {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(el.clientWidth * dpr));
    const h = Math.max(1, Math.round(el.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(loc("u_resolution"), w, h);
    gl.uniform1f(loc("u_pixelRatio"), dpr);
    return true;
  };

  const draw = (seconds) => {
    gl.uniform1f(loc("u_time"), seconds);
    gl.uniform1f(loc("u_sourceAspect"), aspect);
    // Ease at a fixed rate per frame rather than per second: that is what
    // upstream does, and the lag IS the effect for every shader that trails.
    pointer.x += (pointer.tx - pointer.x) * 0.09;
    pointer.y += (pointer.ty - pointer.y) * 0.09;
    const vx = pointer.x - pointer.px;
    const vy = pointer.y - pointer.py;
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.strength += (pointer.target - pointer.strength) * 0.08;
    gl.uniform2f(loc("u_mouse"), pointer.x, pointer.y);
    gl.uniform2f(loc("u_velocity"), vx, vy);
    gl.uniform2f(loc("u_pointer"), pointer.x, 1 - pointer.y);
    gl.uniform1f(loc("u_pointerStrength"), pointer.strength);
    setUniforms();
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const frame = (now) => {
    raf = null;
    if (torn) return;
    draw((now - start) / 1000);
    if (visible) raf = requestAnimationFrame(frame);
  };

  const play = () => {
    if (torn || raf !== null || !visible || reducedMotion()) return;
    raf = requestAnimationFrame(frame);
  };

  /** Every texture the shader asks for, or a rejection that lands in bail(). */
  const loadTextures = () => {
    const names = Object.keys(state.textures);
    if (!names.length) return Promise.resolve([]);
    return Promise.all(
      names.map(
        (name) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve({ name, img });
            img.onerror = () => reject(new Error(`texture ${name}`));
            img.src = state.textures[name];
          }),
      ),
    );
  };

  Promise.all([
    fetch(shaderUrl).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))),
    loadTextures(),
  ])
    .then(([frag, images]) => {
      if (torn) return; // destroy() ran while the shader was in flight
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      // Inline, so an effect's style.css does not have to know this file exists.
      // -1 puts it above the resting layer at -2 and below the scrim at 0.
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;z-index:-1";
      const attrs = { failIfMajorPerformanceCaveat: true, antialias: false, alpha: true, depth: false, stencil: false };
      // webgl2 only, with no webgl1 fallback: the shaders are #version 300 es
      // and there is nothing for a webgl1 context to compile.
      gl = canvas.getContext("webgl2", attrs);
      if (!gl) return bail();

      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, frag);
      if (!vs || !fs) return bail();
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      // The shader objects are attached; deleting them now just drops our
      // reference, and the program keeps them alive until it is deleted.
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return bail();
      gl.useProgram(program);

      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

      images.forEach(({ name, img }, i) => {
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + i);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        // CLAMP and LINEAR, no mips: a hero photo is not power-of-two and
        // REPEAT on a non-power-of-two texture is incomplete in WebGL1 terms
        // and wrong-looking here regardless.
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.uniform1i(loc(name), i);
        texUnits.set(name, { unit: i, tex });
        if (i === 0) aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
      });

      if (opts.pointer) {
        el.addEventListener("pointermove", onMove);
        el.addEventListener("pointerenter", onEnter);
        el.addEventListener("pointerleave", onLeave);
      }

      el.prepend(canvas);
      el.setAttribute("data-fx-live", "");
      canvas.addEventListener("webglcontextlost", bail);
      start = performance.now();
      // Size and paint once before the loop: u_resolution is 0 until resize()
      // runs, and every one of these shaders divides by it. Under reduced
      // motion this single frame is the entire effect.
      resize();
      draw(0);
      ro = new ResizeObserver(() => {
        if (torn) return;
        if (resize() && raf === null) draw(reducedMotion() ? 0 : (performance.now() - start) / 1000);
      });
      ro.observe(el);
      // Scrolled out of view costs nothing; back in view resumes. Reduced
      // motion never enters the loop at all -- resize() paints frame 0 and
      // that single still frame is the whole effect.
      io = new IntersectionObserver(([e]) => {
        visible = e?.isIntersecting ?? true;
        if (visible) play();
        else if (raf !== null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
      });
      io.observe(el);
      play();
    })
    .catch(bail);

  return {
    update(next = {}) {
      if (torn) return;
      Object.assign(state.uniforms, next.uniforms);
      Object.assign(state.ints, next.ints);
      // A still frame has no loop to pick the change up, so repaint it here.
      if (gl && raf === null) draw(reducedMotion() ? 0 : (performance.now() - start) / 1000);
    },
    destroy: bail,
  };
}
