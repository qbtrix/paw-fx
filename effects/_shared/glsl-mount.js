// glsl-mount: the one WebGL runtime the eight shader.gallery ports share.
//
// New file. Not an effect -- effects/_shared/ is skipped by effectDirs(), and
// build-registry copies this file into every item whose index.js imports it.
//
// Why it exists: shader.gallery publishes a bare `shader.frag` per effect with
// no module around it, written in GLSL ES 1.00 (`gl_FragColor`, no #version).
// Paper's ShaderMount pairs its fragment shader with a `#version 300 es`
// vertex shader, so those two cannot link together; running the eight through
// it was tried and is not possible without editing the upstream GLSL, which is
// the one thing the port must not do. So: one full-screen quad, one rAF loop,
// the uniform set shader.gallery's runtime documents (u_time, u_resolution,
// u_mouse, u_pixelRatio, u_palette[4]) plus the effect's own float params.
// Eight effects, one runtime, no upstream GLSL touched.
//
// What it deliberately does not have: shader.gallery's post chain (bloom,
// grain, vignette) lives in @shader-gallery/runtime, a package we do not
// vendor, so our output is the raw shader. Each effect declares that in
// meta.json `deviations`. u_mouse stays at (0,0): every one of the eight ships
// a mouse-influence default of 0 or no mouse param at all, so a pointer
// listener would be dead weight on all eight.
//
// Failure is always the same exit: no WebGL, a context refused for a major
// performance caveat, a 404 on the .frag, a shader that will not compile, a
// context lost later -- all land in bail(), which tears the canvas down and
// leaves the section showing the CSS resting state it was already showing.

const VERT = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

const MAX_DPR = 2; // a 4K hero at dpr 3 is 24M fragments a frame for no visible gain

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// "#abc", "#aabbcc" or a computed "rgb(r, g, b)". Straight /255, no gamma
// step: the upstream shaders describe u_palette as "linear-ish 0..1 rgb", and
// passing the CSS value through unchanged is also what keeps the shader and
// the CSS resting state on visibly the same colours.
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

/** Four colours for u_palette: caller's option, else --fx-c1..--fx-c4, else the port's own default. */
export function paletteFor(el, colors, fallback) {
  const source = Array.isArray(colors) && colors.length === 4 ? colors : null;
  if (source) return source.map((c, i) => rgb(c, rgb(fallback[i])));
  const style = getComputedStyle(el);
  return fallback.map((def, i) => rgb(style.getPropertyValue(`--fx-c${i + 1}`).trim(), rgb(def)));
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
 * @param el         section to paint into
 * @param shaderUrl  URL of the upstream shader.frag, passed by the effect so it
 *                   resolves against the EFFECT's directory and not this one
 * @param opts       { palette: [[r,g,b] x4], uniforms: { u_name: number } }
 */
export function mountGlsl(el, shaderUrl, opts = {}) {
  const resting = { update() {}, destroy() {} };
  if (!el || typeof WebGLRenderingContext === "undefined") return resting;

  const state = { palette: opts.palette, uniforms: { ...opts.uniforms } };
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
  const locs = new Map();

  const bail = () => {
    if (torn) return;
    torn = true;
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    ro?.disconnect();
    io?.disconnect();
    canvas?.removeEventListener("webglcontextlost", bail);
    if (gl) {
      if (program) gl.deleteProgram(program);
      if (buffer) gl.deleteBuffer(buffer);
      // Releasing the context is the point: a page with several heroes on it
      // hits the browser's 8-16 live context ceiling otherwise, and the
      // oldest context is killed rather than this one.
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
    canvas?.remove();
    el.removeAttribute("data-fx-live");
  };

  // An unused uniform is stripped by the compiler and its location is null,
  // which every gl.uniform* call treats as a silent no-op -- that is what lets
  // one uniform set serve eight shaders that each declare a different subset.
  // The bracket retry is for u_palette: "name" is the spec'd way to reach an
  // array's first element, and the explicit form is the safety net.
  const loc = (name) => {
    if (!locs.has(name)) {
      locs.set(name, gl.getUniformLocation(program, name) ?? gl.getUniformLocation(program, `${name}[0]`));
    }
    return locs.get(name);
  };

  const setUniforms = () => {
    for (const [name, value] of Object.entries(state.uniforms)) {
      if (typeof value === "number") gl.uniform1f(loc(name), value);
    }
    // vec3 u_palette[4]: one flat array of 12 floats at the array's location.
    gl.uniform3fv(loc("u_palette"), state.palette.flat());
  };

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

  fetch(shaderUrl)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
    .then((frag) => {
      if (torn) return; // destroy() ran while the shader was in flight
      canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      // Inline, so an effect's style.css does not have to know this file exists.
      // -1 puts it above the resting layer at -2 and below the scrim at 0.
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;z-index:-1";
      const attrs = { failIfMajorPerformanceCaveat: true, antialias: false, alpha: true, depth: false, stencil: false };
      gl = canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs);
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
      gl.uniform2f(loc("u_mouse"), 0, 0);
      setUniforms();

      el.prepend(canvas);
      canvas.addEventListener("webglcontextlost", bail);
      start = performance.now();
      // Size and paint once before the loop: u_resolution is 0 until resize()
      // runs, and every one of the eight divides by it. Under reduced motion
      // this single frame is the entire effect.
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
        else if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
      });
      io.observe(el);
      el.setAttribute("data-fx-live", "");
      play();
    })
    .catch(bail);

  return {
    update(next = {}) {
      if (torn || !program) return;
      if (next.palette) state.palette = next.palette;
      Object.assign(state.uniforms, next.uniforms ?? {});
      gl.useProgram(program);
      setUniforms();
      if (raf === null) draw(reducedMotion() ? 0 : (performance.now() - start) / 1000);
    },
    destroy: bail,
  };
}
