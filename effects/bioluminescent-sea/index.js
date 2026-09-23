// ardentia -- https://github.com/Raflael/ardentia
//
// MIT License
// Copyright (c) 2026 Rafael Medeiros
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.
//
// bioluminescent-sea: a port of Raflael/ardentia at commit
// 7e1a155474eba09583b6707cf32bd20e2512b7a8, index.html. A night sea that is
// dark until something moves through it. The water is a real incompressible
// solver (Stable Fluids, Stam 1999: semi-Lagrangian advection, Jacobi
// projection, vorticity confinement) on a coarse CPU grid; tens of thousands
// of dinoflagellates drift in it, flash when the water SHEARS rather than when
// it merely moves, spend a luciferin reserve that takes seconds to refill, and
// are summed as HDR light through a two-level bloom, so a dense flash walks
// blue to cyan to white instead of clipping flat. Two or three fish swim
// through and are never drawn: the silhouette you see is the plankton answering
// the water they push.
//
// Upstream lines 60-656 -- the constants, the solver, the fish, the plankton,
// the shaders and the HDR/bloom draw -- sit inside inicia() below verbatim, at
// upstream's own indentation so a diff against the pinned file reads clean.
// The only lines inside that block that differ are the three constants that
// became options (APAGA, RECARGA, VORT) and the two that sized the world from
// the window. Everything after "paw-fx seams" replaces upstream's lines
// 658-730, which bound input and resize to the window and carried a headless
// test harness driven by the host page's query string. meta.json.deviations
// lists each change.

const DEFAULTS = { fade: 0.3, recharge: 7, vorticity: 0.55 };
// A zero or negative decay or recharge divides by zero inside the step and
// fills every buffer with NaN for good, so a bad value falls back to upstream's.
const pos = (v, d) => (v > 0 ? +v : d);

export function mount(el, opts = {}) {
  var resting = { update: function () {}, destroy: function () {} };
  if (!el || typeof document === 'undefined') return resting;
  // Upstream has no reduced-motion path. This sea only lights where the water
  // moves, so it has no honest still frame: under reduced motion the section
  // keeps its CSS resting state and the solver never starts.
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return resting;

  var o = Object.assign({}, DEFAULTS, opts);
  var canvas = document.createElement('canvas');
  canvas.className = 'fx-sea__canvas';
  canvas.setAttribute('aria-hidden', 'true');
  var gl = canvas.getContext('webgl2', { antialias: false, alpha: false, failIfMajorPerformanceCaveat: true });
  if (!gl) return resting;

  // Every GL resource is built before the first listener is attached, so a
  // shader that will not compile throws here with nothing to undo but the
  // context, and the section stays at rest.
  try {
    return inicia();
  } catch (err) {
    var perda = gl.getExtension('WEBGL_lose_context');
    if (perda) perda.loseContext();
    return resting;
  }

  function inicia() {
  /* ------------------------------------------------------------------
   * Constantes do mundo
   * ------------------------------------------------------------------ */

  var CEL = 12;            // lado da célula do fluido, em px CSS
  var LIMIAR = 1.2;        // cisalhamento (1/s) abaixo do qual o dinoflagelado não reage
  var FAIXA = 4;           // quanto acima do limiar até o clarão máximo
  var APAGA = pos(o.fade, DEFAULTS.fade);           // s: meia-vida aproximada do clarão
  var RECARGA = pos(o.recharge, DEFAULTS.recharge);   // s: tempo para a luciferina se refazer
  var AMORTECE = 2.5;      // s: a água se acalma sozinha
  var VORT = pos(o.vorticity, DEFAULTS.vorticity);  // confinamento de vorticidade: mantém os redemoinhos vivos

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var W, H, GW, GH, SW;
  var u, v, u0, v0, p, dv, vort, cisal;
  var N, px, py, brilho, reserva, buf, vbo;
  var peixes = [];
  var tempo = 0;

  var ponteiro = { x: 0, y: 0, px: 0, py: 0, dentro: false, mexendo: 0, andou: 0,
    sx0: 0, sy0: 0, sx1: 0, sy1: 0, corta: false };

  /* ------------------------------------------------------------------
   * Fluido: Stable Fluids (Stam, 1999) numa grade grossa, na CPU.
   * Velocidade em px/s; a grade só decide onde a água está.
   * ------------------------------------------------------------------ */

  function criaMundo() {
    // paw-fx seam: the world is the section, not the window
    W = el.clientWidth || 1;
    H = el.clientHeight || 1;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);

    GW = Math.ceil(W / CEL); GH = Math.ceil(H / CEL); SW = GW + 2;
    var t = SW * (GH + 2);
    u = new Float32Array(t); v = new Float32Array(t);
    u0 = new Float32Array(t); v0 = new Float32Array(t);
    p = new Float32Array(t); dv = new Float32Array(t);
    vort = new Float32Array(t); cisal = new Float32Array(t);

    N = Math.min(100000, Math.round(W * H / 26));
    px = new Float32Array(N); py = new Float32Array(N);
    brilho = new Float32Array(N); reserva = new Float32Array(N);
    buf = new Float32Array(N * 3);
    for (var k = 0; k < N; k++) {
      px[k] = Math.random() * W; py[k] = Math.random() * H;
      reserva[k] = 0.6 + Math.random() * 0.4;
    }

    peixes = [];
    var qtd = W > 900 ? 3 : 2;
    for (var f = 0; f < qtd; f++) peixes.push(criaPeixe(f));

    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, buf.byteLength, gl.DYNAMIC_DRAW);
    criaAlvos();
  }

  function bordas() {
    var i, j, sw = SW, gw = GW, gh = GH;
    for (j = 1; j <= gh; j++) {
      u[sw * j] = -u[1 + sw * j]; u[gw + 1 + sw * j] = -u[gw + sw * j];
      v[sw * j] = v[1 + sw * j]; v[gw + 1 + sw * j] = v[gw + sw * j];
    }
    for (i = 1; i <= gw; i++) {
      u[i] = u[i + sw]; u[i + sw * (gh + 1)] = u[i + sw * gh];
      v[i] = -v[i + sw]; v[i + sw * (gh + 1)] = -v[i + sw * gh];
    }
  }

  function bordaEscalar(a) {
    var i, j, sw = SW, gw = GW, gh = GH;
    for (j = 1; j <= gh; j++) { a[sw * j] = a[1 + sw * j]; a[gw + 1 + sw * j] = a[gw + sw * j]; }
    for (i = 1; i <= gw; i++) { a[i] = a[i + sw]; a[i + sw * (gh + 1)] = a[i + sw * gh]; }
  }

  function advecta(dt) {
    var sw = SW, gw = GW, gh = GH, k = dt / CEL;
    for (var j = 1; j <= gh; j++) {
      for (var i = 1; i <= gw; i++) {
        var id = i + sw * j;
        var x = i - k * u[id], y = j - k * v[id];
        if (x < 0.5) x = 0.5; else if (x > gw + 0.5) x = gw + 0.5;
        if (y < 0.5) y = 0.5; else if (y > gh + 0.5) y = gh + 0.5;
        var i0 = x | 0, j0 = y | 0, s1 = x - i0, t1 = y - j0, s0 = 1 - s1, t0 = 1 - t1;
        var a = i0 + sw * j0, b = a + sw;
        u0[id] = s0 * (t0 * u[a] + t1 * u[b]) + s1 * (t0 * u[a + 1] + t1 * u[b + 1]);
        v0[id] = s0 * (t0 * v[a] + t1 * v[b]) + s1 * (t0 * v[a + 1] + t1 * v[b + 1]);
      }
    }
    var tr = u; u = u0; u0 = tr;
    tr = v; v = v0; v0 = tr;
    bordas();
  }

  function projeta() {
    var sw = SW, gw = GW, gh = GH, i, j, id, it;
    for (j = 1; j <= gh; j++) {
      for (i = 1; i <= gw; i++) {
        id = i + sw * j;
        dv[id] = -0.5 * (u[id + 1] - u[id - 1] + v[id + sw] - v[id - sw]);
      }
    }
    bordaEscalar(dv);
    // p fica do quadro anterior: começar do palpite certo poupa iterações
    for (it = 0; it < 16; it++) {
      for (j = 1; j <= gh; j++) {
        for (i = 1; i <= gw; i++) {
          id = i + sw * j;
          p[id] = (dv[id] + p[id - 1] + p[id + 1] + p[id - sw] + p[id + sw]) * 0.25;
        }
      }
      bordaEscalar(p);
    }
    for (j = 1; j <= gh; j++) {
      for (i = 1; i <= gw; i++) {
        id = i + sw * j;
        u[id] -= 0.5 * (p[id + 1] - p[id - 1]);
        v[id] -= 0.5 * (p[id + sw] - p[id - sw]);
      }
    }
    bordas();
  }

  function vorticidade(dt) {
    var sw = SW, gw = GW, gh = GH, i, j, id;
    for (j = 1; j <= gh; j++) {
      for (i = 1; i <= gw; i++) {
        id = i + sw * j;
        vort[id] = 0.5 * ((v[id + 1] - v[id - 1]) - (u[id + sw] - u[id - sw]));
      }
    }
    for (j = 2; j < gh; j++) {
      for (i = 2; i < gw; i++) {
        id = i + sw * j;
        var nx = 0.5 * (Math.abs(vort[id + 1]) - Math.abs(vort[id - 1]));
        var ny = 0.5 * (Math.abs(vort[id + sw]) - Math.abs(vort[id - sw]));
        var len = Math.sqrt(nx * nx + ny * ny) + 1e-5;
        var w = vort[id] * VORT * dt;
        u[id] += (ny / len) * w;
        v[id] -= (nx / len) * w;
      }
    }
  }

  // taxa de deformação (1/s): é o cisalhamento que deforma a membrana e dispara o clarão
  function calculaCisalhamento() {
    var sw = SW, gw = GW, gh = GH, k = 0.5 / CEL, i, j, id;
    for (j = 1; j <= gh; j++) {
      for (i = 1; i <= gw; i++) {
        id = i + sw * j;
        var dudx = (u[id + 1] - u[id - 1]) * k, dvdy = (v[id + sw] - v[id - sw]) * k;
        var dudy = (u[id + sw] - u[id - sw]) * k, dvdx = (v[id + 1] - v[id - 1]) * k;
        var sh = dudy + dvdx;
        cisal[id] = Math.sqrt(dudx * dudx + dvdy * dvdy + 0.5 * sh * sh);
      }
    }
    bordaEscalar(cisal);
  }

  // puxa a água perto de (x, y) para a velocidade (vx, vy)
  function empurra(x, y, vx, vy, raio, forca) {
    var gx = x / CEL + 0.5, gy = y / CEL + 0.5, r = raio / CEL;
    var i0 = Math.max(1, Math.floor(gx - 2 * r)), i1 = Math.min(GW, Math.ceil(gx + 2 * r));
    var j0 = Math.max(1, Math.floor(gy - 2 * r)), j1 = Math.min(GH, Math.ceil(gy + 2 * r));
    var r2 = r * r;
    for (var j = j0; j <= j1; j++) {
      for (var i = i0; i <= i1; i++) {
        var dx = i - gx, dy = j - gy;
        var g = Math.exp(-(dx * dx + dy * dy) / r2) * forca;
        if (g < 0.004) continue;
        var id = i + SW * j;
        u[id] += (vx - u[id]) * g;
        v[id] += (vy - v[id]) * g;
      }
    }
  }

  /* ------------------------------------------------------------------
   * Peixes: invisíveis. Só empurram a água e esbarram no plâncton.
   * ------------------------------------------------------------------ */

  function criaPeixe(f) {
    var n = 14, L = 95 + Math.random() * 70;
    var lado = f % 2 === 0;
    var ang = lado ? (Math.random() - 0.5) * 0.8 : Math.PI + (Math.random() - 0.5) * 0.8;
    var x0 = lado ? -60 - f * 140 : W + 60 + f * 140;
    var y0 = H * (0.25 + 0.5 * Math.random());
    var pe = { n: n, seg: L / n, ang: ang, vagar: 0, susto: 0, fase: Math.random() * 6,
      base: 55 + Math.random() * 35,
      x: new Float32Array(n), y: new Float32Array(n), ox: new Float32Array(n), oy: new Float32Array(n),
      larg: new Float32Array(n), minx: 0, maxx: 0, miny: 0, maxy: 0 };
    for (var i = 0; i < n; i++) {
      pe.x[i] = x0 - Math.cos(ang) * pe.seg * i;
      pe.y[i] = y0 - Math.sin(ang) * pe.seg * i;
      // perfil fusiforme: cabeça arredondada, corpo cheio, pedúnculo fino, nadadeira abrindo
      var t = i / (n - 1);
      var corpo = Math.pow(Math.sin(Math.PI * Math.min(1, (t + 0.08) / 0.9)), 0.7);
      pe.larg[i] = L * 0.1 * (t > 0.86 ? 0.55 + (t - 0.86) * 5 : Math.max(0.15, corpo));
    }
    return pe;
  }

  function difAng(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  function atualizaPeixe(f, dt) {
    var hx = f.x[0], hy = f.y[0], desejo = null, m = 70, i;
    if (hx < m || hx > W - m || hy < m || hy > H - m) desejo = Math.atan2(H / 2 - hy, W / 2 - hx);
    if (ponteiro.mexendo > 0) {
      var dx = hx - ponteiro.x, dy = hy - ponteiro.y;
      if (dx * dx + dy * dy < 190 * 190) { desejo = Math.atan2(dy, dx); f.susto = 1; }
    }
    f.vagar += (Math.random() - 0.5) * 6 * dt;
    f.vagar *= Math.exp(-dt * 1.5);
    if (desejo !== null) {
      var giro = (2 + 3 * f.susto) * dt;
      f.ang += Math.max(-giro, Math.min(giro, difAng(desejo, f.ang)));
    } else {
      f.ang += f.vagar * dt;
    }
    f.susto *= Math.exp(-dt / 1.1);

    var vel = f.base + 230 * f.susto;
    f.fase += dt * (5 + vel * 0.035);
    var rumo = f.ang + Math.sin(f.fase) * 0.28;
    for (i = 0; i < f.n; i++) { f.ox[i] = f.x[i]; f.oy[i] = f.y[i]; }
    f.x[0] += Math.cos(rumo) * vel * dt;
    f.y[0] += Math.sin(rumo) * vel * dt;
    // o corpo segue a cabeça como uma corrente: a ondulação sai de graça
    for (i = 1; i < f.n; i++) {
      var ddx = f.x[i] - f.x[i - 1], ddy = f.y[i] - f.y[i - 1];
      var d = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      f.x[i] = f.x[i - 1] + ddx / d * f.seg;
      f.y[i] = f.y[i - 1] + ddy / d * f.seg;
    }
    f.minx = f.maxx = f.x[0]; f.miny = f.maxy = f.y[0];
    for (i = 0; i < f.n; i++) {
      if (i % 2 === 0) {
        empurra(f.x[i], f.y[i], (f.x[i] - f.ox[i]) / dt, (f.y[i] - f.oy[i]) / dt, f.larg[i] * 0.8 + 4, 0.3);
      }
      if (f.x[i] < f.minx) f.minx = f.x[i]; else if (f.x[i] > f.maxx) f.maxx = f.x[i];
      if (f.y[i] < f.miny) f.miny = f.y[i]; else if (f.y[i] > f.maxy) f.maxy = f.y[i];
    }
    f.minx -= 20; f.maxx += 20; f.miny -= 20; f.maxy += 20;
  }

  function distSeg2(x, y, ax, ay, bx, by) {
    var abx = bx - ax, aby = by - ay, apx = x - ax, apy = y - ay;
    var t = (apx * abx + apy * aby) / (abx * abx + aby * aby || 1);
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var dx = apx - abx * t, dy = apy - aby * t;
    return dx * dx + dy * dy;
  }

  /* ------------------------------------------------------------------
   * Dinoflagelados: flutuam com a água, acendem com o cisalhamento,
   * gastam luciferina e precisam de tempo para recarregar.
   * ------------------------------------------------------------------ */

  function atualizaPlancton(dt) {
    var sw = SW, gw = GW, gh = GH, inv = 1 / CEL;
    var decai = Math.exp(-dt / APAGA), rec = dt / RECARGA;
    var pc = ponteiro.corta, ax = ponteiro.sx0, ay = ponteiro.sy0, bx = ponteiro.sx1, by = ponteiro.sy1;
    var pminx = Math.min(ax, bx) - 20, pmaxx = Math.max(ax, bx) + 20;
    var pminy = Math.min(ay, by) - 20, pmaxy = Math.max(ay, by) + 20;
    var nf = peixes.length, f, s, i;

    for (var k = 0; k < N; k++) {
      var x = px[k], y = py[k];
      var gx = x * inv + 0.5, gy = y * inv + 0.5;
      if (gx < 0.5) gx = 0.5; else if (gx > gw + 0.5) gx = gw + 0.5;
      if (gy < 0.5) gy = 0.5; else if (gy > gh + 0.5) gy = gh + 0.5;
      var i0 = gx | 0, j0 = gy | 0, s1 = gx - i0, t1 = gy - j0, s0 = 1 - s1, t0 = 1 - t1;
      var a = i0 + sw * j0, b = a + sw;
      var uu = s0 * (t0 * u[a] + t1 * u[b]) + s1 * (t0 * u[a + 1] + t1 * u[b + 1]);
      var vv = s0 * (t0 * v[a] + t1 * v[b]) + s1 * (t0 * v[a + 1] + t1 * v[b + 1]);
      var sh = s0 * (t0 * cisal[a] + t1 * cisal[b]) + s1 * (t0 * cisal[a + 1] + t1 * cisal[b + 1]);

      x += (uu + (Math.random() - 0.5) * 6) * dt;
      y += (vv + (Math.random() - 0.5) * 6) * dt;
      if (x < 0) x += W; else if (x >= W) x -= W;
      if (y < 0) y += H; else if (y >= H) y -= H;
      px[k] = x; py[k] = y;

      var est = (sh - LIMIAR) / FAIXA;

      // contato direto: o dedo e o corpo dos peixes
      if (pc && x > pminx && x < pmaxx && y > pminy && y < pmaxy &&
          distSeg2(x, y, ax, ay, bx, by) < 18 * 18) est = 1;
      for (f = 0; f < nf; f++) {
        s = peixes[f];
        if (x < s.minx || x > s.maxx || y < s.miny || y > s.maxy) continue;
        for (i = 0; i < s.n - 1; i++) {
          var r = s.larg[i] + 5;
          if (distSeg2(x, y, s.x[i], s.y[i], s.x[i + 1], s.y[i + 1]) < r * r) { est = 0.95; break; }
        }
      }

      var bk = brilho[k] * decai;
      if (est > 0) {
        if (est > 1) est = 1;
        var alvo = Math.sqrt(est) * reserva[k];   // raiz: realça os clarões médios
        if (alvo > bk) { reserva[k] -= (alvo - bk) * 0.35; bk = alvo; }
      }
      brilho[k] = bk;
      reserva[k] += (1 - reserva[k]) * rec;
    }

    // clarões espontâneos, raros e fracos: o mar calmo nunca está totalmente morto
    var faiscas = N * 0.004 * dt + Math.random();
    for (var q = 0; q < faiscas - 1; q++) {
      var kk = (Math.random() * N) | 0;
      var fa = (0.12 + Math.random() * 0.2) * reserva[kk];
      if (fa > brilho[kk]) brilho[kk] = fa;
    }

    var d = dpr;
    for (k = 0; k < N; k++) {
      buf[3 * k] = px[k] * d; buf[3 * k + 1] = py[k] * d; buf[3 * k + 2] = brilho[k];
    }
  }

  /* ------------------------------------------------------------------
   * Passo da simulação
   * ------------------------------------------------------------------ */

  function passo(dt) {
    tempo += dt;
    var P = ponteiro;
    P.corta = false;
    if (P.dentro) {
      var vx = (P.x - P.px) / dt, vy = (P.y - P.py) / dt;
      var vel = Math.sqrt(vx * vx + vy * vy);
      if (vel > 3000) { vx *= 3000 / vel; vy *= 3000 / vel; vel = 3000; }
      if (vel > 25) {
        for (var s = 0; s < 3; s++) {
          var t = (s + 0.5) / 3;
          empurra(P.px + (P.x - P.px) * t, P.py + (P.y - P.py) * t, vx, vy, 34, 0.55);
        }
        P.mexendo = 0.35;
        P.andou += vel * dt;
        if (vel > 80) { P.corta = true; P.sx0 = P.px; P.sy0 = P.py; P.sx1 = P.x; P.sy1 = P.y; }
      }
    }
    P.mexendo = Math.max(0, P.mexendo - dt);
    P.px = P.x; P.py = P.y;

    for (var f = 0; f < peixes.length; f++) atualizaPeixe(peixes[f], dt);

    // corrente de fundo, bem lenta
    var sw = SW, amp = 3 * dt;
    for (var j = 1; j <= GH; j++) {
      var cj = Math.sin(j * 0.09 + tempo * 0.13) * amp;
      for (var i = 1; i <= GW; i++) {
        var id = i + sw * j;
        u[id] += cj;
        v[id] += Math.sin(i * 0.07 - tempo * 0.11) * amp * 0.6;
      }
    }

    vorticidade(dt);
    advecta(dt);
    var am = Math.exp(-dt / AMORTECE);
    for (var k = 0; k < u.length; k++) { u[k] *= am; v[k] *= am; }
    projeta();
    calculaCisalhamento();
    atualizaPlancton(dt);
  }

  /* ------------------------------------------------------------------
   * Desenho em HDR: os dinoflagelados somam luz numa textura de ponto
   * flutuante, a luz vaza por um bloom em dois níveis e só no fim vira
   * cor de tela. Por isso muitos clarões juntos vão de azul a ciano a
   * branco, como na foto de uma onda bioluminescente, em vez de estourar
   * num azul chapado.
   * ------------------------------------------------------------------ */

  function compila(tipo, src) {
    var s = gl.createShader(tipo);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function programa(vs, fs) {
    var pr = gl.createProgram();
    gl.attachShader(pr, compila(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, compila(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    return pr;
  }

  var progPontos = programa([
    '#version 300 es',
    'in vec3 a;',
    'uniform vec2 uRes; uniform float uHalo; uniform float uDpr;',
    'out float vB;',
    'void main() {',
    '  vB = a.z;',
    '  vec2 c = a.xy / uRes * 2.0 - 1.0;',
    '  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);',
    '  if (uHalo > 0.5) {',
    '    if (a.z < 0.04) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }',
    '    gl_PointSize = (5.0 + 16.0 * a.z) * uDpr;',
    '  } else {',
    '    gl_PointSize = (1.5 + 2.5 * a.z) * uDpr;',
    '  }',
    '}'
  ].join('\n'), [
    '#version 300 es',
    'precision highp float;',
    'in float vB; uniform float uHalo;',
    'out vec4 cor;',
    'void main() {',
    '  vec2 d = gl_PointCoord - 0.5;',
    '  float r2 = dot(d, d) * 4.0;',
    '  if (r2 > 1.0) discard;',
    // a luciferase dos dinoflagelados emite perto de 475 nm: azul puxando para o ciano
    '  vec3 luz = vec3(0.10, 0.55, 1.0);',
    '  vec3 c;',
    '  if (uHalo > 0.5) c = luz * exp(-r2 * 3.0) * vB * 0.35;',
    '  else c = mix(vec3(0.20, 0.32, 0.42) * 0.05, luz * (0.4 + vB * 3.2), min(1.0, vB * 4.0)) * exp(-r2 * 2.2);',
    '  cor = vec4(c, 1.0);',
    '}'
  ].join('\n'));

  // um triângulo que cobre a tela inteira, sem buffer de vértices
  var VS_TELA = [
    '#version 300 es',
    'out vec2 vUv;',
    'void main() {',
    '  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));',
    '  vUv = p;',
    '  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);',
    '}'
  ].join('\n');

  // reduz 4x4 pixels a 1 com quatro leituras bilineares: nenhum ponto some entre as amostras
  var progReduz = programa(VS_TELA, [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv; uniform sampler2D uTex; uniform vec2 uTexel;',
    'out vec4 cor;',
    'void main() {',
    '  vec3 s = texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb;',
    '  s += texture(uTex, vUv + uTexel * vec2(1.0, -1.0)).rgb;',
    '  s += texture(uTex, vUv + uTexel * vec2(-1.0, 1.0)).rgb;',
    '  s += texture(uTex, vUv + uTexel * vec2(1.0, 1.0)).rgb;',
    '  cor = vec4(s * 0.25, 1.0);',
    '}'
  ].join('\n'));

  // gaussiana de 9 amostras em 5 leituras (pesos para amostragem linear)
  var progBorrao = programa(VS_TELA, [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv; uniform sampler2D uTex; uniform vec2 uPasso;',
    'out vec4 cor;',
    'void main() {',
    '  vec3 s = texture(uTex, vUv).rgb * 0.227027;',
    '  s += (texture(uTex, vUv + uPasso * 1.384615).rgb + texture(uTex, vUv - uPasso * 1.384615).rgb) * 0.316216;',
    '  s += (texture(uTex, vUv + uPasso * 3.230769).rgb + texture(uTex, vUv - uPasso * 3.230769).rgb) * 0.070270;',
    '  cor = vec4(s, 1.0);',
    '}'
  ].join('\n'));

  var progFinal = programa(VS_TELA, [
    '#version 300 es',
    'precision highp float;',
    'in vec2 vUv; uniform sampler2D uA; uniform sampler2D uB; uniform sampler2D uC;',
    'out vec4 cor;',
    'void main() {',
    '  vec3 c = texture(uA, vUv).rgb + texture(uB, vUv).rgb * 1.5 + texture(uC, vUv).rgb * 1.3;',
    // exposição: azul satura primeiro, depois verde, depois vermelho — azul, ciano, branco
    '  c = vec3(1.0) - exp(-c);',
    '  cor = vec4(c + vec3(0.004, 0.012, 0.028), 1.0);',
    '}'
  ].join('\n'));

  var uRes = gl.getUniformLocation(progPontos, 'uRes');
  var uHalo = gl.getUniformLocation(progPontos, 'uHalo');
  var uDpr = gl.getUniformLocation(progPontos, 'uDpr');
  var uReduzTex = gl.getUniformLocation(progReduz, 'uTex');
  var uReduzTexel = gl.getUniformLocation(progReduz, 'uTexel');
  var uBorraTex = gl.getUniformLocation(progBorrao, 'uTex');
  var uPasso = gl.getUniformLocation(progBorrao, 'uPasso');
  gl.useProgram(progFinal);
  gl.uniform1i(gl.getUniformLocation(progFinal, 'uA'), 0);
  gl.uniform1i(gl.getUniformLocation(progFinal, 'uB'), 1);
  gl.uniform1i(gl.getUniformLocation(progFinal, 'uC'), 2);

  var vaoPontos = gl.createVertexArray();
  gl.bindVertexArray(vaoPontos);
  vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  var loc = gl.getAttribLocation(progPontos, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 12, 0);
  var vaoVazio = gl.createVertexArray();

  // sem render em ponto flutuante, cai para 8 bits: funciona, só perde a gradação do branco
  var flutua = !!gl.getExtension('EXT_color_buffer_float');
  var alvos = null;

  function alvo(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, flutua ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA,
      flutua ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex: tex, fb: fb, w: w, h: h };
  }

  function criaAlvos() {
    if (alvos) {
      for (var nome in alvos) { gl.deleteTexture(alvos[nome].tex); gl.deleteFramebuffer(alvos[nome].fb); }
    }
    var w = canvas.width, h = canvas.height;
    var w1 = Math.max(1, Math.ceil(w / 4)), h1 = Math.max(1, Math.ceil(h / 4));
    var w2 = Math.max(1, Math.ceil(w1 / 4)), h2 = Math.max(1, Math.ceil(h1 / 4));
    alvos = { luz: alvo(w, h), m1: alvo(w1, h1), b1: alvo(w1, h1), m2: alvo(w2, h2), b2: alvo(w2, h2) };
  }

  function passe(para) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, para.fb);
    gl.viewport(0, 0, para.w, para.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function reduz(de, para) {
    gl.useProgram(progReduz);
    gl.bindTexture(gl.TEXTURE_2D, de.tex);
    gl.uniform1i(uReduzTex, 0);
    gl.uniform2f(uReduzTexel, 1 / de.w, 1 / de.h);
    passe(para);
  }

  function borra(de, para, sx, sy) {
    gl.useProgram(progBorrao);
    gl.bindTexture(gl.TEXTURE_2D, de.tex);
    gl.uniform1i(uBorraTex, 0);
    gl.uniform2f(uPasso, sx, sy);
    passe(para);
  }

  function desenha() {
    var A = alvos;

    // 1. luz de cada dinoflagelado, somada
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.luz.fb);
    gl.viewport(0, 0, A.luz.w, A.luz.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(progPontos);
    gl.bindVertexArray(vaoPontos);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, buf);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.uniform2f(uRes, A.luz.w, A.luz.h);
    gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uHalo, 1); gl.drawArrays(gl.POINTS, 0, N);
    gl.uniform1f(uHalo, 0); gl.drawArrays(gl.POINTS, 0, N);
    gl.disable(gl.BLEND);

    // 2. bloom: um halo próximo (1/4) e um largo (1/16)
    gl.bindVertexArray(vaoVazio);
    gl.activeTexture(gl.TEXTURE0);
    reduz(A.luz, A.m1);
    borra(A.m1, A.b1, 1 / A.b1.w, 0);
    borra(A.b1, A.m1, 0, 1 / A.m1.h);
    reduz(A.m1, A.m2);
    borra(A.m2, A.b2, 1 / A.b2.w, 0);
    borra(A.b2, A.m2, 0, 1 / A.m2.h);

    // 3. composição e exposição
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(progFinal);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.luz.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, A.m1.tex);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, A.m2.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
  }

  /* ------------------------------------------------------------------
   * paw-fx seams: input, resize, visibility and the loop. Upstream's
   * lines 658-730 bind these to the window and run a headless harness
   * off the page's query string; here they are bound to the section.
   * ------------------------------------------------------------------ */

  function poe(e) {
    var r = el.getBoundingClientRect();
    ponteiro.x = e.clientX - r.left; ponteiro.y = e.clientY - r.top;
    if (!ponteiro.dentro) { ponteiro.px = ponteiro.x; ponteiro.py = ponteiro.y; ponteiro.dentro = true; }
  }
  function desce(e) { ponteiro.dentro = false; poe(e); }
  function sobe(e) { if (e.pointerType !== 'mouse') ponteiro.dentro = false; }
  function sai() { ponteiro.dentro = false; }
  el.addEventListener('pointermove', poe);
  el.addEventListener('pointerdown', desce);
  el.addEventListener('pointerup', sobe);
  el.addEventListener('pointerleave', sai);
  window.addEventListener('blur', sai);

  var redimensiona = null;
  var ro = new ResizeObserver(function () {
    if (el.clientWidth === W && el.clientHeight === H) return;
    clearTimeout(redimensiona);
    redimensiona = setTimeout(criaMundo, 200);
  });

  // A 50k-organism CPU step every frame is worth stopping when nobody can see
  // it. Starts true, so a browser that never delivers a callback still runs.
  var visivel = true, raf = 0, vivo = false, ultimo = 0;
  var io = new IntersectionObserver(function (es) {
    visivel = es[es.length - 1].isIntersecting;
    if (visivel && !raf) { ultimo = performance.now(); raf = requestAnimationFrame(quadro); }
  });

  function quadro(agora) {
    if (!visivel) { raf = 0; return; }
    var dt = Math.min(0.033, Math.max(0.001, (agora - ultimo) / 1000));
    ultimo = agora;
    passo(dt);
    desenha();
    // only once a frame is on the canvas, so the CSS rest never fades out
    // from under an empty one
    if (!vivo) { vivo = true; el.setAttribute('data-fx-live', ''); }
    raf = requestAnimationFrame(quadro);
  }

  criaMundo();
  el.insertBefore(canvas, el.firstChild);
  ro.observe(el);
  io.observe(el);
  ultimo = performance.now();
  raf = requestAnimationFrame(quadro);

  return {
    update: function (next) {
      Object.assign(o, next || {});
      APAGA = pos(o.fade, DEFAULTS.fade);
      RECARGA = pos(o.recharge, DEFAULTS.recharge);
      VORT = pos(o.vorticity, DEFAULTS.vorticity);
    },
    destroy: function () {
      visivel = false;
      cancelAnimationFrame(raf); raf = 0;
      clearTimeout(redimensiona);
      ro.disconnect(); io.disconnect();
      el.removeEventListener('pointermove', poe);
      el.removeEventListener('pointerdown', desce);
      el.removeEventListener('pointerup', sobe);
      el.removeEventListener('pointerleave', sai);
      window.removeEventListener('blur', sai);
      var perda = gl.getExtension('WEBGL_lose_context');
      if (perda) perda.loseContext();
      canvas.remove();
      el.removeAttribute('data-fx-live');
    }
  };
  }
}

export const meta = {
  name: "bioluminescent-sea",
  version: "1.0.0",
  category: "backgrounds",
  needs: [],
  license: "MIT",
  options: {
    fade: { type: "number", default: 0.3, min: 0.05, max: 2, description: "Seconds, roughly the half-life of one flash (upstream APAGA). Longer leaves longer glowing wakes behind whatever moved." },
    recharge: { type: "number", default: 7, min: 0.5, max: 30, description: "Seconds for a cell to refill its luciferin after it flashes (upstream RECARGA). This is what makes the sea tire where you keep stirring and relight a while later." },
    vorticity: { type: "number", default: 0.55, min: 0.05, max: 2, description: "Vorticity confinement (upstream VORT): how hard the solver holds eddies together. Low values let the water smear to a blur; higher keeps the swirls, and the light, turning after the cursor stops." },
  },
};
