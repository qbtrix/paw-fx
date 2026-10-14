// splitflap by Roman Diukachov — MIT License
// https://github.com/enavermate/splitflap
//
// MIT License
// Copyright (c) 2026 Roman Diukachov
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// split-flap: a port of enavermate/splitflap at commit
// 730ce0391e054c74082292d4812854af32edfc2d (dist/chunk-6QR3BTCU.js, the
// planner, and dist/chunk-L4NHPYXD.js, the canvas player). Departure-board
// text: every letter of a line rolls, flips or flickers through its alphabet
// into place on a 2D canvas, while the real text stays in the DOM for screen
// readers. The repo publishes no source tree; the committed dist modules are
// the upstream, and both are kept verbatim below in dependency order with only
// their import and export lines removed. The seams are the mount/update/destroy
// wrapper at the bottom: each [data-fx-flap] line gets one SplitflapBoard, the
// boards start when the section first comes on screen, and the lines cycle
// through their data-fx-words while it stays there. See meta.json.deviations.

// ---- dist/chunk-6QR3BTCU.js ----
// src/planner/glyphs.ts
function splitGlyphs(text) {
  const out = [];
  let joinNext = false;
  let flagHalf = false;
  let linker = -1;
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0) ?? 0;
    const last = out.length - 1;
    const conjunct = linker >= 0 && sameBlock(linker, cp) && !isMark(ch);
    if (last >= 0 && (joinNext || conjunct || extendsPrevious(cp, ch) || flagHalf && isRegionalIndicator(cp))) {
      out[last] += ch;
      joinNext = cp === ZWJ;
      flagHalf = false;
      linker = LINKERS.has(cp) ? cp : cp === ZWJ ? linker : -1;
      continue;
    }
    out.push(ch);
    joinNext = false;
    flagHalf = isRegionalIndicator(cp);
    linker = -1;
  }
  return out;
}
var ZWJ = 8205;
var LINKERS = /* @__PURE__ */ new Set([2381, 2509, 2765, 2893, 3149, 3405]);
function sameBlock(a, b) {
  return Math.floor(a / 128) === Math.floor(b / 128);
}
var MARK = (() => {
  try {
    return new RegExp("^\\p{M}$", "u");
  } catch {
    return null;
  }
})();
function isMark(ch) {
  return MARK !== null && MARK.test(ch);
}
function isRegionalIndicator(cp) {
  return cp >= 127462 && cp <= 127487;
}
function extendsPrevious(cp, ch) {
  return cp === ZWJ || isMark(ch) || cp >= 768 && cp <= 879 || // combining diacritical marks
  cp >= 6832 && cp <= 6911 || cp >= 7616 && cp <= 7679 || cp >= 8400 && cp <= 8447 || // combining marks for symbols, the keycap U+20E3
  cp >= 65024 && cp <= 65039 || // variation selectors: text or emoji presentation
  cp >= 65056 && cp <= 65071 || cp >= 127995 && cp <= 127999 || // skin tones
  cp >= 917536 && cp <= 917631 || // tags: subdivision flags (England, Scotland)
  cp >= 917760 && cp <= 917999;
}

// src/planner/fold.ts
var FOLD_FROM = "\xE0\xE1\xE2\xE3\xE4\xE5\xE7\xE8\xE9\xEA\xEB\xEC\xED\xEE\xEF\xF1\xF2\xF3\xF4\xF5\xF6\xF9\xFA\xFB\xFC\xFD\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0129\u012B\u012D\u012F\u0135\u0137\u013A\u013C\u013E\u0144\u0146\u0148\u014D\u014F\u0151\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E\u01A1\u01B0\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DF\u01E1\u01E3\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021F\u0227\u0229\u022B\u022D\u022F\u0231\u0233\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95\u1E96\u1E97\u1E98\u1E99\u1E9B\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u0374\u037E\u0385\u03AC\u0387\u03AD\u03AE\u03AF\u03CC\u03CD\u03CE\u0390\u03CA\u03CB\u03B0\u03D3\u03D4\u1F00\u1F01\u1F02\u1F03\u1F04\u1F05\u1F06\u1F07\u1F10\u1F11\u1F12\u1F13\u1F14\u1F15\u1F20\u1F21\u1F22\u1F23\u1F24\u1F25\u1F26\u1F27\u1F30\u1F31\u1F32\u1F33\u1F34\u1F35\u1F36\u1F37\u1F40\u1F41\u1F42\u1F43\u1F44\u1F45\u1F50\u1F51\u1F52\u1F53\u1F54\u1F55\u1F56\u1F57\u1F60\u1F61\u1F62\u1F63\u1F64\u1F65\u1F66\u1F67\u1F70\u1F71\u1F72\u1F73\u1F74\u1F75\u1F76\u1F77\u1F78\u1F79\u1F7A\u1F7B\u1F7C\u1F7D\u1F80\u1F81\u1F82\u1F83\u1F84\u1F85\u1F86\u1F87\u1F90\u1F91\u1F92\u1F93\u1F94\u1F95\u1F96\u1F97\u1FA0\u1FA1\u1FA2\u1FA3\u1FA4\u1FA5\u1FA6\u1FA7\u1FB0\u1FB1\u1FB2\u1FB3\u1FB4\u1FB6\u1FB7\u1FBE\u1FC1\u1FC2\u1FC3\u1FC4\u1FC6\u1FC7\u1FCD\u1FCE\u1FCF\u1FD0\u1FD1\u1FD2\u1FD3\u1FD6\u1FD7\u1FDD\u1FDE\u1FDF\u1FE0\u1FE1\u1FE2\u1FE3\u1FE4\u1FE5\u1FE6\u1FE7\u1FED\u1FEE\u1FEF\u1FF2\u1FF3\u1FF4\u1FF6\u1FF7\u1FFD\u0450\u0451\u0453\u0457\u045C\u045D\u045E\u0439\u0477\u04C2\u04D1\u04D3\u04D7\u04DB\u04DD\u04DF\u04E3\u04E5\u04E7\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F9";
var FOLD_TO = "aaaaaaceeeeiiiinooooouuuuyyaaaccccdeeeeegggghiiiijklllnnnooorrrssssttuuuuuuwyzzzouaiouuuuuaa\xE6gkoo\u0292jgna\xE6\xF8aaeeiioorruusthaeooooyabbbcdddddeeeeefghhhhhiikkkllllmmmnnnnoooopprrrrsssssttttuuuuuvvwwwwwxxyzzzhtwy\u017Faaaaaaaaaaaaeeeeeeeeiioooooooooooouuuuuuuyyyy\u02B9;\xA8\u03B1\xB7\u03B5\u03B7\u03B9\u03BF\u03C5\u03C9\u03B9\u03B9\u03C5\u03C5\u03D2\u03D2\u03B1\u03B1\u03B1\u03B1\u03B1\u03B1\u03B1\u03B1\u03B5\u03B5\u03B5\u03B5\u03B5\u03B5\u03B7\u03B7\u03B7\u03B7\u03B7\u03B7\u03B7\u03B7\u03B9\u03B9\u03B9\u03B9\u03B9\u03B9\u03B9\u03B9\u03BF\u03BF\u03BF\u03BF\u03BF\u03BF\u03C5\u03C5\u03C5\u03C5\u03C5\u03C5\u03C5\u03C5\u03C9\u03C9\u03C9\u03C9\u03C9\u03C9\u03C9\u03C9\u03B1\u03B1\u03B5\u03B5\u03B7\u03B7\u03B9\u03B9\u03BF\u03BF\u03C5\u03C5\u03C9\u03C9\u03B1\u03B1\u03B1\u03B1\u03B1\u03B1\u03B1\u03B1\u03B7\u03B7\u03B7\u03B7\u03B7\u03B7\u03B7\u03B7\u03C9\u03C9\u03C9\u03C9\u03C9\u03C9\u03C9\u03C9\u03B1\u03B1\u03B1\u03B1\u03B1\u03B1\u03B1\u03B9\xA8\u03B7\u03B7\u03B7\u03B7\u03B7\u1FBF\u1FBF\u1FBF\u03B9\u03B9\u03B9\u03B9\u03B9\u03B9\u1FFE\u1FFE\u1FFE\u03C5\u03C5\u03C5\u03C5\u03C1\u03C1\u03C5\u03C5\xA8\xA8`\u03C9\u03C9\u03C9\u03C9\u03C9\xB4\u0435\u0435\u0433\u0456\u043A\u0438\u0443\u0438\u0475\u0436\u0430\u0430\u0435\u04D9\u0436\u0437\u0438\u0438\u043E\u04E9\u044D\u0443\u0443\u0443\u0447\u044B";

// src/planner/alphabets.ts
var letters = (s) => s.split(" ");
var range = (from, to) => Array.from(
  { length: to - from + 1 },
  (_, i) => String.fromCodePoint(from + i)
);
function table(id, order, core = order) {
  return { id, order, core: new Set(core) };
}
var LATIN = table(
  "latin",
  letters(
    "a \xE6 b c d \u0111 \xF0 e f g h i \u0131 j k l \u0142 m n \xF1 \u014B o \xF8 \u0153 p q r s \xDF t \xFE u v w x y z"
  ),
  letters("a b c d e f g h i j k l m n o p q r s t u v w x y z")
);
var CYRILLIC = table(
  "cyrillic",
  letters(
    "\u0430 \u04D9 \u0431 \u0432 \u0433 \u0491 \u0493 \u0434 \u0452 \u0453 \u0435 \u0454 \u0451 \u0436 \u0497 \u0437 \u0455 \u0438 \u0456 \u0457 \u0439 \u0458 \u043A \u049B \u045C \u043B \u0459 \u043C \u043D \u04A3 \u045A \u043E \u04E9 \u043F \u0440 \u0441 \u0442 \u045B \u0443 \u045E \u04AF \u04B1 \u0444 \u0445 \u04BB \u0446 \u0447 \u045F \u0448 \u0449 \u044A \u044B \u044C \u044D \u044E \u044F"
  ),
  letters("\u0430 \u0431 \u0432 \u0433 \u0434 \u0435 \u0436 \u0437 \u0438 \u043A \u043B \u043C \u043D \u043E \u043F \u0440 \u0441 \u0442 \u0443 \u0444 \u0445 \u0446 \u0447 \u0448")
);
var GREEK = table(
  "greek",
  letters("\u03B1 \u03B2 \u03B3 \u03B4 \u03B5 \u03B6 \u03B7 \u03B8 \u03B9 \u03BA \u03BB \u03BC \u03BD \u03BE \u03BF \u03C0 \u03C1 \u03C3 \u03C2 \u03C4 \u03C5 \u03C6 \u03C7 \u03C8 \u03C9"),
  letters("\u03B1 \u03B2 \u03B3 \u03B4 \u03B5 \u03B6 \u03B7 \u03B8 \u03B9 \u03BA \u03BB \u03BC \u03BD \u03BE \u03BF \u03C0 \u03C1 \u03C3 \u03C4 \u03C5 \u03C6 \u03C7 \u03C8 \u03C9")
);
var ARMENIAN = table(
  "armenian",
  [...range(1377, 1414), "\u0587"],
  range(1377, 1414)
);
var GEORGIAN = table("georgian", range(4304, 4336));
var LETTER = (() => {
  try {
    return new RegExp("^\\p{L}$", "u");
  } catch {
    return null;
  }
})();
var MARK2 = (() => {
  try {
    return new RegExp("^\\p{M}$", "u");
  } catch {
    return null;
  }
})();
var BLOCKS = [
  ["devanagari", 2308, 2361],
  ["bengali", 2437, 2489],
  ["gurmukhi", 2565, 2617],
  ["gujarati", 2693, 2745],
  ["oriya", 2821, 2873],
  ["tamil", 2949, 3001],
  ["telugu", 3077, 3129],
  ["kannada", 3205, 3257],
  ["malayalam", 3333, 3386],
  ["sinhala", 3461, 3526],
  ["thai", 3585, 3630],
  ["lao", 3713, 3758],
  ["tibetan", 3904, 3948],
  ["myanmar", 4096, 4138],
  ["khmer", 6016, 6067],
  ["hiragana", 12353, 12438],
  ["katakana", 12449, 12538]
];
var SYLLABIC_TABLES = LETTER === null ? [] : BLOCKS.map(
  ([id, from, to]) => table(
    id,
    range(from, to).filter((ch) => LETTER.test(ch))
  )
);
var SYLLABLE_LETTERS = new Set(SYLLABIC_TABLES.flatMap((t) => t.order));
var DIGIT_TABLES = [
  48,
  1632,
  1776,
  2406,
  2534,
  2662,
  2790,
  2918,
  3046,
  3174,
  3302,
  3430,
  3558,
  3664,
  3792,
  3872,
  4160,
  6112,
  65296
].map((zero) => table("digit", range(zero, zero + 9)));
var LETTER_TABLES = [
  LATIN,
  CYRILLIC,
  GREEK,
  ARMENIAN,
  GEORGIAN,
  ...SYLLABIC_TABLES
];
var TABLES = [...LETTER_TABLES, ...DIGIT_TABLES];
var KNOWN = new Set(TABLES.flatMap((t) => t.order));
var FOLD = new Map(
  Array.from(FOLD_FROM).map((ch, i) => [ch, Array.from(FOLD_TO)[i]])
);
function base(ch) {
  const lower = ch.toLowerCase();
  if (KNOWN.has(lower)) return lower;
  const folded = FOLD.get(lower);
  if (folded !== void 0) return folded;
  const [first, ...rest] = Array.from(lower);
  if (first !== void 0 && rest.length > 0) {
    if (rest.every(isCombiningMark)) return base(first);
    if (SYLLABLE_LETTERS.has(first)) return first;
  }
  return lower;
}
function isCombiningMark(ch) {
  if (MARK2 !== null && MARK2.test(ch)) return true;
  const cp = ch.codePointAt(0) ?? 0;
  return cp >= 768 && cp <= 879 || cp >= 6832 && cp <= 6911 || cp >= 7616 && cp <= 7679 || cp >= 8400 && cp <= 8447 || cp >= 65056 && cp <= 65071;
}
function tableOf(ch) {
  const b = base(ch);
  return TABLES.find((t) => t.order.includes(b));
}
function travel(t, seen) {
  return {
    id: t.id,
    letters: t.order.filter((l) => t.core.has(l) || seen.has(l))
  };
}
function resolveScripts(option, seen) {
  if (typeof option === "object") {
    return [
      {
        id: "custom",
        letters: Array.from(new Set(Array.from(option.letters.toLowerCase())))
      }
    ];
  }
  const glyphs = splitGlyphs(seen);
  const bases = new Set(glyphs.map(base));
  const first = option === "auto" ? glyphs.map(tableOf).find((t) => t !== void 0 && t.id !== "digit") : LETTER_TABLES.find((t) => t.id === option);
  const ordered = first ? [first, ...TABLES.filter((t) => t !== first)] : TABLES;
  return ordered.map((t) => travel(t, bases));
}
function scriptOf(ch, scripts) {
  if (!ch) return void 0;
  const b = base(ch);
  return scripts.find((s) => s.letters.includes(b));
}
function indexIn(s, ch) {
  return s.letters.indexOf(base(ch));
}
function isUpperCase(ch) {
  return ch !== "" && ch !== ch.toLowerCase();
}
function withCase(letter, ref) {
  return isUpperCase(ref) ? letter.toUpperCase() : letter;
}
function scrambleLetters(target, scripts) {
  const s = scriptOf(target, scripts);
  if (!s) return "";
  return s.letters.map((l) => withCase(l, target)).join("");
}
function widthGlyphs(text) {
  const scripts = resolveScripts("auto", text);
  const glyphs = /* @__PURE__ */ new Set();
  for (const ch of splitGlyphs(text)) {
    glyphs.add(ch);
    for (const letter of Array.from(scrambleLetters(ch, scripts)))
      glyphs.add(letter);
  }
  return Array.from(glyphs).sort().join("");
}

// src/planner/random.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 1831565813 >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash(...parts) {
  let h = 2166136261;
  for (const part of parts) {
    h ^= part | 0;
    h = Math.imul(h, 2654435761);
    h ^= h >>> 15;
  }
  return h >>> 0;
}
function pick(rng, items) {
  const item = items[Math.floor(rng() * items.length)];
  if (item === void 0) throw new Error("pick from an empty list");
  return item;
}
function permutation(rng, n) {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = order[i];
    order[i] = order[j];
    order[j] = a;
  }
  return order;
}

// src/planner/paths.ts
var NEIGHBOUR_REACH = 9;
function randomLetters(n, s, caseRef, rng) {
  return Array.from(
    { length: n },
    () => withCase(pick(rng, s.letters), caseRef)
  );
}
function oneStep(from, to, dir = 1) {
  return { path: [from, to], dir };
}
function through(from, letters2, to, dir = 1) {
  return { path: [from, ...letters2, to], dir };
}
function orderDir(from, to, scripts) {
  const sf = scriptOf(from, scripts);
  const st = scriptOf(to, scripts);
  if (!sf || sf !== st) return 1;
  return indexIn(sf, to) >= indexIn(sf, from) ? 1 : -1;
}
function edgePath(from, to, steps, ctx) {
  const s = scriptOf(from || to, ctx.scripts);
  if (!s) return oneStep(from, to);
  return through(from, randomLetters(steps, s, to || from, ctx.rng), to);
}
function rollPath(from, to, ctx) {
  if (!from || !to) return edgePath(from, to, 2, ctx);
  return oneStep(from, to, orderDir(from, to, ctx.scripts));
}
function alphabetPath(from, to, ctx, flip) {
  if (!to && flip) return oneStep(from, "", -1);
  if (!from || !to) return edgePath(from, to, 3, ctx);
  const sf = scriptOf(from, ctx.scripts);
  const st = scriptOf(to, ctx.scripts);
  if (sf && sf === st) {
    const i = indexIn(sf, from);
    const j = indexIn(sf, to);
    const step = j > i ? 1 : -1;
    const dist = Math.abs(j - i);
    if (dist === 0) return oneStep(from, to);
    if (dist <= NEIGHBOUR_REACH) {
      const between = [];
      for (let k = i + step; k !== j; k += step)
        between.push(withCase(sf.letters[k], to));
      return through(from, between, to, step);
    }
    return through(from, randomLetters(5, sf, to, ctx.rng), to, step);
  }
  if (!st) return oneStep(from, to);
  return through(from, randomLetters(3, st, to, ctx.rng), to);
}
function cellPath(transition, from, to, ctx) {
  switch (transition) {
    case "roll":
      return rollPath(from, to, ctx);
    case "scramble":
      return oneStep(from, to, orderDir(from, to, ctx.scripts));
    case "reel":
      return alphabetPath(from, to, ctx, false);
    case "flip":
      return alphabetPath(from, to, ctx, true);
  }
}
function durationFor(transition, duration) {
  switch (transition) {
    case "flip":
      return Math.round(duration * 1.6);
    default:
      return duration;
  }
}
function easingFor(transition) {
  switch (transition) {
    case "reel":
      return "inOut";
    case "flip":
      return "linear";
    default:
      return "out";
  }
}
var SCRAMBLE_STEP_MS = 55;

// src/planner/timeline.ts
var ease = {
  out: (t) => 1 - Math.pow(1 - t, 3),
  inOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  linear: (t) => t
};
function cellTime(bc, now) {
  let t = now - bc.startMs;
  if (bc.loopMs !== void 0 && bc.loopMs > 0)
    t = (t % bc.loopMs + bc.loopMs) % bc.loopMs;
  return t - bc.cell.delayMs;
}
function positionAt(bc, now) {
  const { cell } = bc;
  const t = cellTime(bc, now);
  if (cell.land <= 0 || cell.durationMs <= 0 || t >= cell.durationMs) {
    return { k: cell.land, f: 0, moving: false };
  }
  if (t <= 0) return { k: 0, f: 0, moving: false };
  const p = ease[cell.easing](t / cell.durationMs) * cell.land;
  const k = Math.floor(p);
  if (k >= cell.land) return { k: cell.land, f: 0, moving: false };
  return { k, f: p - k, moving: true };
}
function glyphAt(bc, now) {
  const { k, f } = positionAt(bc, now);
  const path = bc.cell.path;
  const index = f < 0.5 ? k : Math.min(k + 1, path.length - 1);
  return path[index] ?? "";
}

// src/planner/retarget.ts
var roundFraction = (f) => Math.round(f * 1e3) / 1e3;
function originAt(bc, now) {
  if (!bc) return { from: "" };
  const from = glyphAt(bc, now);
  const pos = positionAt(bc, now);
  return pos.moving ? { from, resume: { k: pos.k, f: roundFraction(pos.f) } } : { from };
}

// src/planner/plan.ts
var DEFAULT_DURATION_MS = 650;
var DEFAULT_STAGGER_MS = 40;
var BOARD_CELL = -1;
var BOARD_DIRECTION = -2;
function createBoard() {
  return { revision: 0, cells: [] };
}
function drafts(board, text, now) {
  const chars = splitGlyphs(text);
  const n = Math.max(chars.length, board.cells.length);
  return Array.from({ length: n }, (_, i) => ({
    i,
    to: chars[i] ?? "",
    ...originAt(board.cells[i], now)
  }));
}
function settled(d) {
  const cell = {
    i: d.i,
    from: d.to,
    to: d.to,
    path: [d.to],
    delayMs: 0,
    durationMs: 0,
    easing: "out",
    dir: 1,
    land: 0
  };
  return d.resume ? { ...cell, resume: d.resume } : cell;
}
function staggerOrdinals(count, order, seed) {
  switch (order) {
    case "ltr":
      return Array.from({ length: count }, (_, i) => i);
    case "rtl":
      return Array.from({ length: count }, (_, i) => count - 1 - i);
    case "random":
      return permutation(mulberry32(seed), count);
  }
}
function forcedDir(s, i, dir) {
  if (s.direction === "up") return 1;
  if (s.direction === "down") return -1;
  if (s.direction === "random") return i % 2 === s.topParity ? -1 : 1;
  return dir;
}
function animated(d, ordinal, s) {
  const rng = mulberry32(hash(s.seed, s.revision, d.i));
  const { path, dir } = cellPath(s.transition, d.from, d.to, {
    scripts: s.scripts,
    rng
  });
  const cell = {
    i: d.i,
    from: d.from,
    to: d.to,
    path,
    delayMs: ordinal * s.stagger,
    durationMs: durationFor(s.transition, s.duration),
    easing: d.resume ? "out" : easingFor(s.transition),
    dir: forcedDir(s, d.i, dir),
    land: path.length - 1
  };
  if (s.transition === "scramble") {
    cell.stepMs = SCRAMBLE_STEP_MS;
    if (d.to !== "") cell.letters = scrambleLetters(d.to, s.scripts);
  }
  if (d.resume) cell.resume = d.resume;
  return cell;
}
function withoutTrailingBlanks(cells) {
  let end = cells.length;
  while (end > 0) {
    const last = cells[end - 1];
    if (last.from !== "" || last.to !== "") break;
    end--;
  }
  return cells.slice(0, end);
}
function totalMs(cells) {
  return cells.reduce((max, c) => Math.max(max, c.delayMs + c.durationMs), 0);
}
function planTransition(board, input) {
  const transition = input.transition ?? "reel";
  const revision = board.revision + 1;
  const seed = input.seed ?? 1;
  const all = drafts(board, input.text, input.now);
  let cells;
  if (input.instant) {
    cells = all.map((d) => settled({ i: d.i, to: d.to, from: d.to }));
  } else {
    const settings = {
      transition,
      duration: input.duration ?? DEFAULT_DURATION_MS,
      stagger: input.stagger ?? DEFAULT_STAGGER_MS,
      direction: input.direction ?? "random",
      topParity: mulberry32(hash(seed, revision, BOARD_DIRECTION))() < 0.5 ? 0 : 1,
      seed,
      revision,
      // Every glyph before and after: a letter the board is leaving must still be in its alphabet.
      scripts: resolveScripts(
        input.alphabet ?? "auto",
        all.map((d) => d.from + d.to).join("")
      )
    };
    const changed = all.filter((d) => d.from !== d.to);
    const ordinals = staggerOrdinals(
      changed.length,
      input.staggerOrder ?? "ltr",
      hash(seed, revision, BOARD_CELL)
    );
    const ordinalOf = new Map(
      changed.map((d, n) => [d.i, ordinals[n]])
    );
    cells = all.map((d) => {
      const ordinal = ordinalOf.get(d.i);
      return ordinal === void 0 ? settled(d) : animated(d, ordinal, settings);
    });
  }
  cells = withoutTrailingBlanks(cells);
  const plan = { v: 1, transition, totalMs: totalMs(cells), cells };
  const next = {
    revision,
    cells: cells.map((cell) => ({ cell, startMs: input.now }))
  };
  return { plan, board: next };
}

// src/planner/loading.ts
var LOADING_WORD_MS = 430;
var LOADING_WORDS = 8;
var WORDS_CELL = -2;
function randomWord(length, s, previous, rng) {
  return Array.from({ length }, (_, i) => {
    const letter = pick(rng, s.letters);
    return letter === previous[i] ? pick(rng, s.letters) : letter;
  });
}
function lengthRange(length, exact) {
  if (typeof length === "number") {
    return exact ? { min: length, max: length } : { min: length - 1, max: length + 1 };
  }
  const a = Math.floor(length.min);
  const b = Math.floor(length.max);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}
function randomWords(length, s, rng, exact) {
  const range2 = lengthRange(length, exact);
  const min = Math.max(1, Number.isFinite(range2.min) ? range2.min : 1);
  const max = Math.max(min, Number.isFinite(range2.max) ? range2.max : min);
  const words = [];
  for (let w = 0; w < LOADING_WORDS; w++) {
    const len = min + Math.floor(rng() * (max - min + 1));
    words.push(randomWord(len, s, words[w - 1] ?? [], rng));
  }
  return words;
}
function wordScript(scripts, alphabet, glyphs) {
  if (alphabet === void 0 || alphabet === "auto") {
    const seen = glyphs.map((g) => scriptOf(g, scripts));
    const found = seen.find((s) => s !== void 0 && s.id !== "digit") ?? seen.find((s) => s !== void 0);
    if (found) return found;
  }
  return scripts[0];
}
function loadingPlan(length, seed, options) {
  const wordMs = options.wordMs ?? LOADING_WORD_MS;
  const scripts = resolveScripts(
    options.alphabet ?? "auto",
    options.text ?? ""
  );
  const glyphs = splitGlyphs(options.text ?? "");
  const letters2 = glyphs.filter((g) => g.toLowerCase() !== g.toUpperCase());
  const capitals = letters2.length > 0 && letters2.every(isUpperCase);
  const words = randomWords(
    length,
    wordScript(scripts, options.alphabet, glyphs),
    mulberry32(hash(seed, 0, WORDS_CELL)),
    options.exactLength ?? false
  ).map(
    (word) => capitals ? word.map((letter) => letter.toUpperCase()) : word
  );
  const cycle = [...words, words[0]];
  const width = Math.max(...words.map((w) => w.length));
  const durationMs = LOADING_WORDS * wordMs;
  const cells = Array.from({ length: width }, (_, i) => {
    const path = cycle.map((w) => w[i] ?? "");
    const to = path[LOADING_WORDS];
    return {
      i,
      from: path[0],
      to,
      path,
      delayMs: 0,
      durationMs,
      easing: "linear",
      dir: 1,
      land: LOADING_WORDS,
      ...options.transition === "scramble" && to !== "" ? { letters: scrambleLetters(to, scripts) } : {}
    };
  });
  const plan = {
    v: 1,
    transition: options.transition ?? "reel",
    totalMs: durationMs,
    cells,
    loop: true
  };
  const board = {
    revision: 0,
    cells: cells.map((cell) => ({
      cell,
      startMs: options.now,
      loopMs: durationMs
    }))
  };
  return { plan, board };
}

// ---- dist/chunk-L4NHPYXD.js ----
// src/player/atlas.ts
var PAGE = 2048;
var MAX_PAGES = 4;
var Atlas = class {
  constructor(doc) {
    this.doc = doc;
  }
  doc;
  pages = [];
  tiles = /* @__PURE__ */ new Map();
  shelfX = 0;
  shelfY = 0;
  shelfHeight = 0;
  tile(key, width, height, paint) {
    const found = this.tiles.get(key);
    if (found) return found;
    if (width > PAGE || height > PAGE) {
      const canvas2 = this.doc.createElement("canvas");
      canvas2.width = width;
      canvas2.height = height;
      paint(canvas2.getContext("2d"));
      const tile2 = { canvas: canvas2, x: 0, y: 0, width, height };
      this.tiles.set(key, tile2);
      return tile2;
    }
    if (this.shelfX + width > PAGE) {
      this.shelfX = 0;
      this.shelfY += this.shelfHeight + 1;
      this.shelfHeight = 0;
    }
    if (!this.pages.length || this.shelfY + height > PAGE) this.newPage();
    const canvas = this.pages[this.pages.length - 1];
    const tile = { canvas, x: this.shelfX, y: this.shelfY, width, height };
    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.translate(tile.x, tile.y);
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();
    paint(ctx);
    ctx.restore();
    this.shelfX += width + 1;
    this.shelfHeight = Math.max(this.shelfHeight, height);
    this.tiles.set(key, tile);
    return tile;
  }
  newPage() {
    if (this.pages.length >= MAX_PAGES) {
      this.pages = [];
      this.tiles.clear();
    }
    const canvas = this.doc.createElement("canvas");
    canvas.width = PAGE;
    canvas.height = PAGE;
    this.pages.push(canvas);
    this.shelfX = 0;
    this.shelfY = 0;
    this.shelfHeight = 0;
  }
};
var atlases = /* @__PURE__ */ new WeakMap();
function atlasFor(doc) {
  let atlas = atlases.get(doc);
  if (!atlas) {
    atlas = new Atlas(doc);
    atlases.set(doc, atlas);
  }
  return atlas;
}

// src/player/measure.ts
function widthTiers(alphabet, single) {
  if (alphabet.length === 0) return [];
  const sorted = [...alphabet].sort((a, b) => a - b);
  if (single) {
    return [{ limit: Infinity, width: Math.ceil(sorted[sorted.length - 1]) }];
  }
  const median = sorted[Math.floor(sorted.length / 2)];
  const narrowLimit = median * 0.75;
  const wideLimit = median * 1.25;
  let narrow = 0;
  let regular = 0;
  let wide = 0;
  for (const width of sorted) {
    if (width <= narrowLimit) narrow = Math.max(narrow, width);
    else if (width < wideLimit) regular = Math.max(regular, width);
    else wide = Math.max(wide, width);
  }
  const tiers = [];
  if (narrow > 0) tiers.push({ limit: narrowLimit, width: Math.ceil(narrow) });
  if (regular > 0) tiers.push({ limit: wideLimit, width: Math.ceil(regular) });
  if (wide > 0) tiers.push({ limit: Infinity, width: Math.ceil(wide) });
  return tiers;
}
function tierWidth(tiers, width) {
  for (const tier of tiers) {
    if (width <= tier.limit) return Math.max(tier.width, Math.ceil(width));
  }
  return Math.ceil(width);
}
function cellWidths(own, mode, alphabet) {
  let widths;
  if (mode === "tiered" || mode === "uniform") {
    const letters = mode === "uniform" ? [...alphabet(), ...own] : [...alphabet()];
    const tiers = widthTiers(letters, mode === "uniform");
    widths = own.map((w) => tierWidth(tiers, w));
  } else {
    widths = [...own];
  }
  return {
    cellWidths: widths,
    centred: mode === "tiered" || mode === "uniform",
    total: widths.reduce((a, b) => a + b, 0)
  };
}
function visibleCount(widths, glyphs, available, ellipsis) {
  const total = widths.reduce((a, b) => a + b, 0);
  if (!(available > 0) || total <= available + 0.5) return -1;
  let fit = 0;
  let used = 0;
  while (fit < widths.length && used + widths[fit] + ellipsis <= available + 0.5) {
    used += widths[fit];
    fit++;
  }
  while (fit > 0 && glyphs[fit - 1] === " ") fit--;
  return fit < glyphs.length ? fit : -1;
}
var DIGIT = /^\p{Nd}$/u;
function isDigit(glyph) {
  return DIGIT.test(glyph);
}

// src/player/options.ts
var DEFAULT_CELL_WIDTH = {
  flip: "tiered",
  reel: "natural",
  roll: "natural",
  scramble: "tiered"
};
function resolveCellWidth(transition, requested) {
  const fallback = DEFAULT_CELL_WIDTH[transition ?? "reel"];
  if (requested === "uniform") return "uniform";
  if (requested === "natural" && fallback === "natural") return "natural";
  return fallback;
}
var DEFAULT_LOADING_LENGTH = 6;
function planKey(o) {
  return JSON.stringify([
    o.text,
    o.loading ?? false,
    o.loadingLength,
    o.contentKey,
    o.transition,
    o.duration,
    o.stagger,
    o.staggerOrder,
    o.direction,
    o.alphabet,
    o.seed
  ]);
}
function makePlan(board, o, now2, firstShow) {
  if (o.loading) {
    return loadingPlan(
      o.loadingLength ?? (splitGlyphs(o.text).length || DEFAULT_LOADING_LENGTH),
      o.seed ?? 1,
      {
        now: now2,
        alphabet: o.alphabet,
        text: o.text,
        transition: o.transition,
        exactLength: typeof o.loadingLength === "number"
      }
    );
  }
  return planTransition(board, {
    text: o.text,
    now: now2,
    transition: o.transition,
    duration: o.duration,
    stagger: o.stagger,
    staggerOrder: o.staggerOrder,
    direction: o.direction,
    alphabet: o.alphabet,
    seed: o.seed,
    instant: o.animateOnMount === false && firstShow
  });
}

// src/player/timeline.ts
var MASK_FADE = 0.16;
var MASK_RAMP = 6;
var MASK_LEVELS = 32;
var WIDTH_WINDOW = 1.15;
var FLIP_PERSPECTIVE = 220;
var FLAP_FOLD = -1;
var SCRAMBLE_DIM = 0.55;
var SCRAMBLE_MAX_STEPS = 2e3;
var DEFAULT_STEP_MS = 55;
var ELLIPSIS = "\u2026";
function rendererFor(transition) {
  if (transition === "scramble") return "scramble";
  if (transition === "flip") return "flip";
  return "drum";
}
var clamp01 = (x) => Math.min(1, Math.max(0, x));
function easeValue(easing, x) {
  return ease[easing](clamp01(x));
}
function easeInverse(easing, p) {
  const q = clamp01(p);
  switch (easing) {
    case "out":
      return 1 - Math.cbrt(1 - q);
    case "inOut":
      return q < 0.5 ? Math.cbrt(q / 4) : 1 - Math.cbrt(2 * (1 - q)) / 2;
    case "linear":
      return q;
  }
}
function glyphOf(cell, index) {
  return cell.path[index] ?? "";
}
function progress(cell, t) {
  const steps = cell.land;
  if (steps <= 0 || cell.durationMs <= 0) return steps;
  if (t <= cell.delayMs) return 0;
  const x = (t - cell.delayMs) / cell.durationMs;
  return x >= 1 ? steps : steps * easeValue(cell.easing, x);
}
function truncatePlan(plan, count, glyph) {
  if (count <= 0 || count >= plan.cells.length) return plan;
  const cells = plan.cells.slice(0, count);
  const last = cells[count - 1];
  const path = [...last.path];
  path[last.land] = glyph;
  cells[count - 1] = { ...last, to: glyph, path };
  return { ...plan, cells };
}
function playWindow(plan, reduceMotion) {
  if (reduceMotion) return 0;
  let window = plan.totalMs;
  if (window > 0) {
    for (const cell of plan.cells) {
      window = Math.max(window, cell.delayMs + cell.durationMs * WIDTH_WINDOW);
    }
  }
  return window;
}
function isMoving(cell, window) {
  return window > 0 && cell.land > 0 && cell.durationMs > 0;
}
function presented(width) {
  return {
    width,
    glyphYs: /* @__PURE__ */ new Map(),
    topAngle: NaN,
    bottomAngle: NaN,
    dimmed: false
  };
}
function drumLayers(cell, t, h, resume) {
  const steps = cell.land;
  const s = progress(cell, t);
  const k = Math.min(Math.floor(s), steps - 1);
  const blend = k === 0 ? resume * (1 - Math.min(1, s)) : 0;
  const layer = (isA) => {
    const even = k % 2 === 0;
    const glyph = isA === even ? k : k + 1;
    return { glyph, y: cell.dir * (glyph - s) * h + blend };
  };
  return [layer(true), layer(false)];
}
function resumeOffset(cell, previous, h) {
  const y = previous?.glyphYs.get(glyphOf(cell, 0));
  return y !== void 0 && Math.abs(y) < h ? y : 0;
}
function drumMask(layers, h) {
  const rest = Math.min(...layers.map((l) => Math.abs(l.y))) / h;
  return Math.min(1, rest * MASK_RAMP);
}
function flickerOf(cell, index) {
  const to = glyphOf(cell, cell.land);
  if (to === "" || cell.land === 0 || cell.durationMs <= 0) return [];
  const letters = cell.letters ? splitGlyphs(cell.letters) : [to];
  const stepMs = cell.stepMs ?? DEFAULT_STEP_MS;
  const steps = Math.min(
    SCRAMBLE_MAX_STEPS,
    Math.ceil((cell.delayMs + cell.durationMs) / stepMs) + 1
  );
  let state = (2654435769 ^ Math.imul(index + 1, 2246822507)) >>> 0;
  const out = [];
  for (let i = 0; i < steps; i++) {
    state = Math.imul(state, 1664525) + 1013904223 >>> 0;
    out.push(letters[(state >>> 8) % letters.length]);
  }
  return out;
}
function scrambleFrame(cell, t, flicker, previous) {
  const from = glyphOf(cell, 0);
  const to = glyphOf(cell, cell.land);
  const lock = cell.delayMs + cell.durationMs;
  if (to === "") {
    const alpha = t <= cell.delayMs ? 1 : Math.max(0, 1 - (t - cell.delayMs) / (lock - cell.delayMs));
    return t < lock ? { glyph: from, alpha } : null;
  }
  const start = previous?.dimmed ? 0 : cell.delayMs;
  if (t >= lock) return { glyph: to, alpha: 1 };
  if (t < start) return { glyph: from, alpha: 1 };
  const step = Math.floor((t - start) / (cell.stepMs ?? DEFAULT_STEP_MS));
  return { glyph: flicker[step] ?? to, alpha: SCRAMBLE_DIM };
}
function isFlickering(cell, t, previous) {
  const start = previous?.dimmed ? 0 : cell.delayMs;
  return t >= start && t < cell.delayMs + cell.durationMs;
}
var pose = (top, bottom, flapTop, flapTopAngle, flapTopVisible, flapBottom, flapBottomAngle, flapBottomVisible) => ({
  top,
  bottom,
  flapTop,
  flapTopAngle,
  flapTopVisible,
  flapBottom,
  flapBottomAngle,
  flapBottomVisible
});
function flipPose(cell, t, previous) {
  const steps = cell.land;
  const folded = FLAP_FOLD * Math.PI / 2;
  const raised = -FLAP_FOLD * Math.PI / 2;
  const path0 = glyphOf(cell, 0);
  const resumeTop = previous !== void 0 && !Number.isNaN(previous.topAngle) && previous.topGlyph === path0 && previous.topAngle * FLAP_FOLD > 0 && Math.abs(previous.topAngle) < Math.PI / 2;
  const resumeBottom = previous !== void 0 && !resumeTop && !Number.isNaN(previous.bottomAngle) && previous.bottomGlyph === path0 && previous.bottomAngle * FLAP_FOLD < 0 && Math.abs(previous.bottomAngle) < Math.PI / 2;
  const edge = (k2) => cell.delayMs + cell.durationMs * easeInverse(cell.easing, k2 / steps);
  if (t < edge(0)) {
    return pose(
      resumeTop ? 1 : 0,
      0,
      0,
      resumeTop ? previous.topAngle : 0,
      resumeTop,
      0,
      resumeBottom ? previous.bottomAngle : raised,
      resumeBottom
    );
  }
  if (t >= cell.delayMs + cell.durationMs) {
    return pose(steps, steps, 0, 0, false, 0, 0, false);
  }
  let k = 0;
  while (k < steps - 1 && t >= edge(k + 1)) k++;
  const from = edge(k);
  const to = edge(k + 1);
  const mid = (from + to) / 2;
  const topStart = k === 0 && resumeTop ? previous.topAngle : 0;
  if (t < mid) {
    const f2 = (t - from) / (mid - from);
    if (k === 0 && resumeBottom) {
      const a = previous.bottomAngle;
      return pose(
        k + 1,
        k,
        k,
        topStart + (folded - topStart) * f2,
        true,
        0,
        a + (0 - a) * f2,
        true
      );
    }
    return pose(
      k + 1,
      k,
      k,
      topStart + (folded - topStart) * f2,
      true,
      k + 1,
      raised,
      false
    );
  }
  const f = (t - mid) / (to - mid);
  return pose(k + 1, k, k, 0, false, k + 1, raised + (0 - raised) * f, true);
}
function projectRow(y, h, angle, distance) {
  const hinge = h / 2;
  const r = y - hinge;
  const ry = hinge + r * Math.cos(angle);
  const z = r * Math.sin(angle);
  const scale = distance / (distance - z);
  const cy = h / 2;
  return { y: cy + (ry - cy) * scale, scale };
}
function widthAt(w, i, t) {
  const cell = w.plan.cells[i];
  const start = w.startWidths[i] ?? 0;
  const target = w.targetWidths[i] ?? 0;
  if (w.plan.loop && w.loopWidth) {
    const s = progress(cell, t);
    const k = Math.min(Math.floor(s), cell.path.length - 1);
    const here = w.loopWidth(glyphOf(cell, k), i);
    if (k + 1 >= cell.path.length || s >= cell.land) return here;
    const next = w.loopWidth(glyphOf(cell, k + 1), i);
    return here + (next - here) * easeValue("inOut", s - k);
  }
  if (w.holdWidths) {
    const hold = w.holdWidths[i] ?? target;
    const begin = cell.delayMs;
    const open = cell.durationMs / 6;
    const land = begin + cell.durationMs;
    const close = land + cell.durationMs * (WIDTH_WINDOW - 1);
    if (t <= begin || cell.durationMs <= 0) return t <= begin ? start : target;
    if (t < begin + open) {
      return start + (hold - start) * easeValue("inOut", (t - begin) / open);
    }
    if (t < land) return hold;
    if (t >= close) return target;
    return hold + (target - hold) * easeValue("inOut", (t - land) / (close - land));
  }
  const span = cell.durationMs * WIDTH_WINDOW;
  if (t < cell.delayMs) return start;
  if (span <= 0 || t >= cell.delayMs + span) return target;
  return start + (target - start) * easeValue("inOut", (t - cell.delayMs) / span);
}

// src/player/board.ts
var FLAP_STRIP_PX = 6;
var FLAP_STRIPS_MAX = 16;
var BLEED = 0.3;
var now = () => typeof performance !== "undefined" ? performance.now() : Date.now();
var advanceCaches = /* @__PURE__ */ new Map();
var alphabetCaches = /* @__PURE__ */ new Map();
var CACHE_LIMIT = 256;
function cached(cache, key, make) {
  let value = cache.get(key);
  if (value === void 0) {
    if (cache.size >= CACHE_LIMIT) cache.clear();
    value = make();
    cache.set(key, value);
  }
  return value;
}
function isOpaque(color) {
  if (color === "transparent") return false;
  const rgba = /^rgba\((?:[^,]+,){3}\s*([\d.]+)\s*\)$/.exec(color);
  return !rgba || Number(rgba[1]) >= 1;
}
function canvasFont(ctx, styleWeightSize, family) {
  for (const candidate of [
    `${styleWeightSize} ${family}`,
    `${styleWeightSize} ${family.replace(/-webkit-standard|-apple-system-body/g, "serif")}`,
    `${styleWeightSize} serif`
  ]) {
    ctx.font = "1px serif";
    ctx.font = candidate;
    if (ctx.font !== "1px serif") return candidate;
  }
  return `${styleWeightSize} serif`;
}
function zeroOf(digit) {
  const cp = digit.codePointAt(0);
  let start = cp;
  while (start > cp - 60 && isDigit(String.fromCodePoint(start - 1))) start--;
  return start + 10 * Math.floor((cp - start) / 10);
}
var SplitflapBoard = class {
  host;
  canvas;
  ctx;
  label;
  strut;
  resizeObserver;
  motionQuery;
  restoreText;
  options;
  board = createBoard();
  plannedKey = null;
  plannedContentKey;
  style = null;
  cellWidth = "natural";
  textGlyphs = [];
  measured = { cellWidths: [], centred: false, total: 0 };
  measuredKey = "";
  visible = -1;
  /** Width the host's container allows, or Infinity while the whole text fits. */
  available = Infinity;
  requestedWidth = -1;
  observedHeight = -1;
  resizeFrame = 0;
  dpr = 1;
  /** Transition of the last plan: the settled look of `flip` (tiles) outlives its plan. */
  styleTransition = "roll";
  /** Where each cell settled last, so the next plan widens or narrows it from there. */
  modelWidths = [];
  playback = null;
  inFlightText = null;
  generation = 0;
  frame = 0;
  destroyed = false;
  /** No 2D canvas (jsdom, happy-dom): the host just shows the text, so tests of an app run. */
  plain;
  constructor(host, options) {
    this.host = host;
    this.options = options;
    this.restoreText = host.textContent ?? "";
    const doc = host.ownerDocument;
    this.canvas = doc.createElement("canvas");
    let context = null;
    try {
      context = this.canvas.getContext("2d");
    } catch {
    }
    this.plain = context === null;
    this.ctx = context;
    this.strut = doc.createElement("span");
    this.strut.setAttribute("aria-hidden", "true");
    this.strut.textContent = "\u200B";
    this.canvas.setAttribute("aria-hidden", "true");
    Object.assign(this.canvas.style, {
      position: "absolute",
      pointerEvents: "none"
    });
    this.label = doc.createElement("span");
    Object.assign(this.label.style, {
      position: "absolute",
      width: "1px",
      height: "1px",
      overflow: "hidden",
      clipPath: "inset(50%)",
      whiteSpace: "nowrap"
    });
    if (this.plain) {
      this.resizeObserver = null;
      this.motionQuery = null;
      this.update(options);
      return;
    }
    host.replaceChildren(this.strut, this.canvas, this.label);
    Object.assign(host.style, {
      display: "inline-block",
      maxWidth: "100%",
      whiteSpace: "nowrap",
      verticalAlign: "baseline"
    });
    const view = doc.defaultView;
    if (view && view.getComputedStyle(host).position === "static") {
      host.style.position = "relative";
    }
    this.resizeObserver = typeof ResizeObserver === "undefined" ? null : (
      // A resize can redraw the board and so resize it again: done in the callback, the browser
      // reports a loop. The next frame sees the settled size.
      new ResizeObserver(() => {
        if (this.resizeFrame) return;
        this.resizeFrame = requestAnimationFrame(() => {
          this.resizeFrame = 0;
          this.onResize();
        });
      })
    );
    this.resizeObserver?.observe(host);
    this.motionQuery = view?.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    doc.fonts?.addEventListener("loadingdone", this.onFonts);
    if (doc.fonts && doc.fonts.status !== "loaded") {
      doc.fonts.ready.then(this.onFonts, () => {
      });
    }
    if (doc.readyState !== "complete") {
      view?.addEventListener("load", this.onFonts, { once: true });
    }
    this.update(options);
  }
  /** Applies new options: a new text plans a transition from what is on screen. */
  update(options) {
    if (this.destroyed) return;
    this.options = options;
    if (this.plain) {
      if (this.host.textContent !== options.text) {
        this.host.textContent = options.text;
        this.finishInstantly(options.text);
      }
      return;
    }
    this.label.textContent = options.text;
    const restyled = this.readStyle();
    this.cellWidth = resolveCellWidth(options.transition, options.cellWidth);
    this.textGlyphs = splitGlyphs(options.text);
    const remeasured = this.remeasure();
    const key = planKey(options);
    if (key !== this.plannedKey) {
      const firstShow = this.plannedKey === null || this.plannedContentKey !== options.contentKey;
      this.plannedKey = key;
      this.plannedContentKey = options.contentKey;
      const startMs = this.now();
      const result = makePlan(this.board, options, startMs, firstShow);
      this.board = result.board;
      this.styleTransition = result.plan.transition;
      if (result.plan.v > 1 || result.plan.cells.length < this.textGlyphs.length) {
        this.showTextInstantly(true);
      } else {
        this.playPlan(result.plan, startMs);
      }
    } else if (restyled || remeasured) {
      this.restyled();
    }
  }
  /** Re-reads the host's CSS: call after a class or font change the board cannot observe. */
  refresh() {
    if (this.destroyed || this.plain) return;
    const restyled = this.readStyle();
    if (this.remeasure() || restyled) this.restyled();
  }
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.stopFrames();
    this.interruptIfInFlight();
    this.resizeObserver?.disconnect();
    if (this.resizeFrame) cancelAnimationFrame(this.resizeFrame);
    this.host.ownerDocument.fonts?.removeEventListener(
      "loadingdone",
      this.onFonts
    );
    this.host.ownerDocument.defaultView?.removeEventListener(
      "load",
      this.onFonts
    );
    this.host.replaceChildren(this.options.text || this.restoreText);
    this.host.style.width = "";
  }
  now() {
    return (this.options.clock ?? now)();
  }
  onFonts = () => this.refresh();
  // Style and measurement
  readStyle() {
    const view = this.host.ownerDocument.defaultView;
    if (!view) return false;
    const cs = view.getComputedStyle(this.host);
    const font = canvasFont(
      this.ctx,
      `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}`,
      cs.fontFamily
    );
    const letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    const tabular = this.options.tabularDigits ?? !cs.fontVariantNumeric.includes("proportional-nums");
    const ctx = this.ctx;
    ctx.letterSpacing = letterSpacing;
    this.appliedFont = "";
    const metrics = ctx.measureText("H");
    const size = parseFloat(cs.fontSize);
    const fontAscent = metrics.fontBoundingBoxAscent ?? size * 0.9;
    const fontDescent = metrics.fontBoundingBoxDescent ?? size * 0.25;
    const contentHeight = fontAscent + fontDescent;
    const lineHeight = cs.lineHeight === "normal" ? Math.ceil(contentHeight) : parseFloat(cs.lineHeight);
    const ascent = (lineHeight - contentHeight) / 2 + fontAscent;
    const key = `${font}\0${letterSpacing}\0${tabular}`;
    const next = {
      font,
      color: cs.color,
      letterSpacing,
      tabular,
      lineHeight,
      ascent,
      key
    };
    const previous = this.style;
    this.style = next;
    return previous === null || previous.key !== key || previous.color !== next.color || previous.lineHeight !== lineHeight;
  }
  /** The style key the canvas context holds now; a resize of the canvas resets the context. */
  appliedFont = "";
  masks = /* @__PURE__ */ new Map();
  applyFont() {
    const s = this.style;
    if (this.appliedFont === s.key) return;
    this.ctx.font = s.font;
    this.ctx.letterSpacing = s.letterSpacing;
    this.appliedFont = s.key;
  }
  /** A glyph's own advance in the board's font. */
  advance(glyph) {
    if (glyph === "") return 0;
    const cache = cached(advanceCaches, this.style.key, () => /* @__PURE__ */ new Map());
    let width = cache.get(glyph);
    if (width === void 0) {
      this.applyFont();
      width = this.ctx.measureText(glyph).width;
      cache.set(glyph, width);
    }
    return width;
  }
  /** The advance a glyph takes in a line: with tabular digits, every digit as wide as the widest. */
  glyphWidth(glyph) {
    if (this.style.tabular && isDigit(glyph)) {
      const zero = zeroOf(glyph);
      let widest = 0;
      for (let d = 0; d < 10; d++) {
        widest = Math.max(widest, this.advance(String.fromCodePoint(zero + d)));
      }
      return widest;
    }
    return this.advance(glyph);
  }
  alphabetWidths(text) {
    const letters = widthGlyphs(text);
    return cached(
      alphabetCaches,
      `${letters}\0${this.style.key}`,
      () => splitGlyphs(letters).map((g) => this.glyphWidth(g))
    );
  }
  remeasure() {
    const text = this.options.text;
    const key = `${text}\0${this.cellWidth}\0${this.style.key}`;
    if (key === this.measuredKey) return false;
    this.measuredKey = key;
    this.measured = cellWidths(
      this.textGlyphs.map((g) => this.glyphWidth(g)),
      this.cellWidth,
      () => this.alphabetWidths(text)
    );
    this.visible = this.visibleGlyphCount();
    return true;
  }
  visibleGlyphCount() {
    return visibleCount(
      this.measured.cellWidths,
      this.textGlyphs,
      this.available,
      this.advance(ELLIPSIS)
    );
  }
  onResize() {
    if (this.destroyed) return;
    const { width, height } = this.host.getBoundingClientRect();
    if (Math.abs(height - this.observedHeight) > 0.5) {
      const first = this.observedHeight < 0;
      this.observedHeight = height;
      if (!first) {
        this.refresh();
        return;
      }
    }
    if (width < this.requestedWidth - 0.5) this.available = width;
    else if (this.requestedWidth >= this.measured.total - 0.5)
      this.available = Infinity;
    const visible = this.visibleGlyphCount();
    if (visible !== this.visible) {
      this.visible = visible;
      this.restyled();
    }
  }
  /** A new font, size or room: settled text shows at once, loading words start over. */
  restyled() {
    if (this.options.loading) {
      const startMs = this.now();
      const result = makePlan(this.board, this.options, startMs, false);
      this.board = result.board;
      this.playPlan(result.plan, startMs);
    } else {
      this.showTextInstantly(false);
    }
  }
  // Settled layout
  /** What the board shows at rest: the text, or the part that fits and «…». */
  settledGlyphs() {
    return this.visible >= 0 ? [...this.textGlyphs.slice(0, this.visible), ELLIPSIS] : this.textGlyphs;
  }
  /** Left edges of the settled glyphs plus the right edge of the last. */
  settledEdges(glyphs) {
    const edges = new Array(glyphs.length + 1).fill(0);
    for (let i = 0; i < glyphs.length; i++) {
      const own = this.visible >= 0 && i === this.visible ? this.advance(ELLIPSIS) : this.textGlyphWidth(glyphs[i], i);
      edges[i + 1] = edges[i] + own;
    }
    return edges;
  }
  /** The measured width when the glyph is the text's own at that place; its advance otherwise. */
  textGlyphWidth(glyph, index) {
    if (glyph === "") return 0;
    if (this.textGlyphs[index] === glyph && index < this.measured.cellWidths.length) {
      return this.measured.cellWidths[index];
    }
    return this.glyphWidth(glyph);
  }
  // Playback
  reduceMotion() {
    const setting = this.options.reduceMotion ?? "system";
    if (setting === "always") return true;
    if (setting === "never") return false;
    return this.motionQuery?.matches ?? false;
  }
  /** The final text with no motion: Reduce Motion, an unreadable plan, or a new font or size. */
  showTextInstantly(notify) {
    this.interruptIfInFlight();
    this.stopFrames();
    this.playback = null;
    const settled = this.settledGlyphs();
    const edges = this.settledEdges(settled);
    this.modelWidths = settled.map((_, i) => edges[i + 1] - edges[i]);
    this.render();
    if (notify) this.finishInstantly(this.options.text);
  }
  playPlan(full, startMs) {
    const renderer = rendererFor(full.transition);
    const previous = this.playback;
    const captured = previous && this.inFlightText !== null ? this.capturePresented(previous, renderer, startMs) : [];
    this.interruptIfInFlight();
    this.generation++;
    const plan = this.visible >= 0 ? truncatePlan(full, this.visible + 1, ELLIPSIS) : full;
    const settled = this.settledGlyphs();
    const edges = this.settledEdges(settled);
    const window = playWindow(plan, this.reduceMotion());
    const settledWidth = (glyph, i) => settled[i] === glyph ? edges[i + 1] - edges[i] : glyph === "" ? 0 : this.glyphWidth(glyph);
    const startWidths = plan.cells.map(
      (_, i) => captured[i]?.width ?? this.modelWidths[i] ?? 0
    );
    const targetWidths = plan.cells.map(
      (cell, i) => settledWidth(glyphOf(cell, cell.land), i)
    );
    let holdWidths = null;
    if (this.cellWidth === "tiered") {
      holdWidths = plan.cells.map(
        (_, i) => Math.max(startWidths[i], targetWidths[i])
      );
    } else if (this.cellWidth === "uniform") {
      holdWidths = plan.cells.map((cell, i) => {
        const way = renderer === "scramble" ? [...cell.path, ...splitGlyphs(cell.letters ?? "")] : cell.path;
        return way.reduce(
          (widest, glyph) => Math.max(widest, this.glyphWidth(glyph)),
          Math.max(startWidths[i], targetWidths[i])
        );
      });
    }
    let loopWidth;
    if (plan.loop) {
      const words = plan.cells.flatMap((c) => c.path).join("");
      const tiers = this.measured.centred ? widthTiers(this.alphabetWidths(words), this.cellWidth === "uniform") : null;
      loopWidth = (glyph) => {
        if (glyph === "") return 0;
        const own = this.glyphWidth(glyph);
        return tiers ? tierWidth(tiers, own) : own;
      };
    }
    this.stopFrames();
    this.modelWidths = targetWidths;
    const surface = renderer === "flip" || rendererFor(this.styleTransition) === "flip" ? this.surfaceColor() : "";
    const next = {
      plan,
      startWidths,
      targetWidths,
      holdWidths,
      loopWidth,
      text: this.options.text,
      renderer,
      window,
      startMs,
      presented: plan.cells.map((_, i) => captured[i]),
      flicker: plan.cells.map(
        (cell, i) => renderer === "scramble" ? flickerOf(cell, i) : []
      ),
      surface
    };
    if (window > 0) {
      this.playback = next;
      this.inFlightText = next.text;
      this.render();
      this.startFrames();
      this.emitStart(next.text);
    } else {
      this.playback = null;
      this.render();
      this.finishInstantly(next.text);
    }
  }
  time(p, at) {
    const elapsed = Math.max(0, at - p.startMs);
    return p.plan.loop && p.window > 0 ? elapsed % p.window : Math.min(elapsed, p.window);
  }
  // Frames
  startFrames() {
    if (this.frame === 0 && typeof requestAnimationFrame !== "undefined") {
      this.frame = requestAnimationFrame(this.onFrame);
    }
  }
  stopFrames() {
    if (this.frame !== 0) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }
  onFrame = () => {
    this.frame = 0;
    const current = this.playback;
    if (!current || this.destroyed) return;
    const elapsed = this.now() - current.startMs;
    if (current.plan.loop || elapsed < current.window) {
      this.render();
      this.frame = requestAnimationFrame(this.onFrame);
    } else {
      this.playback = null;
      this.render();
      if (this.inFlightText !== null) {
        this.inFlightText = null;
        this.emitEnd(current.text, false);
      }
    }
  };
  // Events
  emitStart(text) {
    const handler = this.options.onTransitionStart;
    if (handler) queueMicrotask(() => handler({ text }));
  }
  emitEnd(text, interrupted) {
    this.options.onTransitionEnd?.({ text, interrupted });
  }
  finishInstantly(text) {
    const expected = ++this.generation;
    this.inFlightText = null;
    queueMicrotask(() => {
      if (this.generation === expected && !this.destroyed) {
        this.emitEnd(text, false);
      }
    });
  }
  interruptIfInFlight() {
    const text = this.inFlightText;
    if (text === null) return;
    this.inFlightText = null;
    this.emitEnd(text, true);
  }
  // Drawing
  /** The colour under the board: what a flap paints so the half it covers never shows through. */
  surfaceColor() {
    if (this.options.surfaceColor) return this.options.surfaceColor;
    const view = this.host.ownerDocument.defaultView;
    for (let el = this.host; el && view; el = el.parentElement) {
      const background = view.getComputedStyle(el).backgroundColor;
      if (isOpaque(background)) return background;
    }
    return "#fff";
  }
  render() {
    const style = this.style;
    if (!style || this.destroyed) return;
    const p = this.playback;
    const t = p ? this.time(p, this.now()) : 0;
    const h = style.lineHeight;
    let widths;
    let settled = null;
    let edges = null;
    if (p) {
      widths = p.plan.cells.map((_, i) => widthAt(p, i, t));
    } else {
      settled = this.settledGlyphs();
      edges = this.settledEdges(settled);
      widths = settled.map((_, i) => edges[i + 1] - edges[i]);
    }
    const content = widths.reduce((a, b) => a + b, 0);
    this.resize(Math.max(content, p ? 0 : this.measured.total), h);
    const ctx = this.ctx;
    const bleed = Math.ceil(h * BLEED);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(
      this.dpr,
      0,
      0,
      this.dpr,
      bleed * this.dpr,
      bleed * this.dpr
    );
    this.applyFont();
    ctx.fillStyle = style.color;
    ctx.textBaseline = "alphabetic";
    if (!p) {
      const flip = rendererFor(this.styleTransition) === "flip";
      const surface = flip ? this.surfaceColor() : "";
      for (let i = 0; i < settled.length; i++) {
        if (flip) this.fillRect(edges[i], 0, widths[i], h, surface);
        this.drawGlyph(settled[i], edges[i], 0, 1, widths[i]);
      }
      return;
    }
    let x = 0;
    for (let i = 0; i < p.plan.cells.length; i++) {
      const cell = p.plan.cells[i];
      const w = widths[i];
      if (!isMoving(cell, p.window) || t >= cell.delayMs + cell.durationMs && !p.plan.loop) {
        if (p.renderer === "flip") this.fillRect(x, 0, w, h, p.surface);
        this.drawGlyph(glyphOf(cell, cell.land), x, 0, 1, w);
      } else {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, 0, w, h);
        ctx.clip();
        if (p.renderer === "drum")
          this.drawDrumCell(cell, x, w, t, h, p.presented[i]);
        else if (p.renderer === "scramble") {
          const frame = scrambleFrame(cell, t, p.flicker[i], p.presented[i]);
          if (frame) this.drawGlyph(frame.glyph, x, 0, frame.alpha, w);
        } else this.drawFlipCell(cell, x, w, t, h, p.surface, p.presented[i]);
        ctx.restore();
      }
      x += w;
    }
  }
  /** Sizes the host to the content and the canvas to the content plus room for the flaps. */
  resize(content, h) {
    if (Math.abs(content - this.requestedWidth) > 0.01) {
      this.requestedWidth = content;
      this.host.style.width = `${content}px`;
    }
    const dpr = this.host.ownerDocument.defaultView?.devicePixelRatio || 1;
    const bleed = Math.ceil(h * BLEED);
    const cssWidth = Math.ceil(content) + 2 * bleed;
    const cssHeight = Math.ceil(h) + 2 * bleed;
    const fits = this.playback && dpr === this.dpr && this.canvas.width >= cssWidth * dpr && this.canvas.height === cssHeight * dpr;
    if (fits) return;
    this.dpr = dpr;
    this.appliedFont = "";
    this.canvas.width = Math.ceil(cssWidth * dpr);
    this.canvas.height = Math.ceil(cssHeight * dpr);
    Object.assign(this.canvas.style, {
      left: `${-bleed}px`,
      top: `${-bleed}px`,
      width: `${this.canvas.width / dpr}px`,
      height: `${this.canvas.height / dpr}px`
    });
  }
  fillRect(x, y, w, h, color) {
    const ctx = this.ctx;
    const fill = ctx.fillStyle;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
  }
  /** `w`: the cell's width now; centred boards and tabular digits centre the glyph in it. */
  drawGlyph(glyph, x, dy, alpha, w) {
    if (glyph === "" || alpha <= 0) return;
    const ctx = this.ctx;
    const dpr = this.dpr;
    const centre = this.measured.centred || this.style.tabular && isDigit(glyph);
    const inset = centre ? (w - this.advance(glyph)) / 2 : 0;
    const tile = this.glyphTile(glyph);
    const left = Math.round((x + inset - tile.bleed) * dpr) / dpr;
    const top = Math.round((dy - tile.bleed) * dpr) / dpr;
    ctx.globalAlpha = alpha;
    ctx.drawImage(
      tile.canvas,
      tile.x,
      tile.y,
      tile.width,
      tile.height,
      left,
      top,
      tile.width / dpr,
      tile.height / dpr
    );
    ctx.globalAlpha = 1;
  }
  /**
   * A glyph painted once in the board's font and colour, with room around its line for marks and
   * swashes that reach past it: fillText for every glyph of every frame was most of a drum's cost.
   */
  glyphTile(glyph) {
    const style = this.style;
    const dpr = this.dpr;
    const bleed = Math.ceil(style.lineHeight * BLEED);
    const width = Math.max(
      1,
      Math.ceil((this.advance(glyph) + 2 * bleed) * dpr)
    );
    const height = Math.max(1, Math.ceil((style.lineHeight + 2 * bleed) * dpr));
    const key = `glyph\0${style.key}\0${style.color}\0${style.ascent}\0${width}\0${height}\0${dpr}\0${glyph}`;
    const tile = atlasFor(this.host.ownerDocument).tile(
      key,
      width,
      height,
      (tctx) => {
        tctx.scale(dpr, dpr);
        tctx.font = style.font;
        tctx.letterSpacing = style.letterSpacing;
        tctx.fillStyle = style.color;
        tctx.textBaseline = "alphabetic";
        tctx.fillText(glyph, bleed, bleed + style.ascent);
      }
    );
    return { ...tile, bleed };
  }
  drawDrumCell(cell, x, w, t, h, previous) {
    const layers = drumLayers(cell, t, h, resumeOffset(cell, previous, h));
    for (const { glyph, y } of layers)
      this.drawGlyph(glyphOf(cell, glyph), x, y, 1, w);
    const strength = drumMask(layers, h);
    if (strength <= 0) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = "destination-out";
    this.fillRect(x, 0, w, h, this.maskGradient(strength, h));
    ctx.globalCompositeOperation = "source-over";
  }
  /** The drum's fade in one of MASK_LEVELS strengths, as the Android player keeps it. */
  maskGradient(strength, h) {
    const level = Math.max(1, Math.round(strength * MASK_LEVELS));
    const key = `${h}\0${level}`;
    let gradient = this.masks.get(key);
    if (!gradient) {
      if (this.masks.size > 4 * MASK_LEVELS) this.masks.clear();
      gradient = this.ctx.createLinearGradient(0, 0, 0, h);
      const edge = `rgba(0,0,0,${level / MASK_LEVELS})`;
      gradient.addColorStop(0, edge);
      gradient.addColorStop(MASK_FADE, "rgba(0,0,0,0)");
      gradient.addColorStop(1 - MASK_FADE, "rgba(0,0,0,0)");
      gradient.addColorStop(1, edge);
      this.masks.set(key, gradient);
    }
    return gradient;
  }
  drawFlipCell(cell, x, w, t, h, surface, previous) {
    const pose2 = flipPose(cell, t, previous);
    const half = h / 2;
    this.drawHalf(glyphOf(cell, pose2.top), x, w, 0, half, h, surface, null);
    this.drawHalf(glyphOf(cell, pose2.bottom), x, w, half, h, h, surface, null);
    if (pose2.flapTopVisible) {
      this.drawHalf(
        glyphOf(cell, pose2.flapTop),
        x,
        w,
        0,
        half,
        h,
        surface,
        pose2.flapTopAngle
      );
    }
    if (pose2.flapBottomVisible) {
      this.drawHalf(
        glyphOf(cell, pose2.flapBottom),
        x,
        w,
        half,
        h,
        h,
        surface,
        pose2.flapBottomAngle
      );
    }
  }
  /** One half of a flip cell, on the surface colour, optionally turned about the hinge. */
  drawHalf(glyph, x, w, top, bottom, h, surface, angle) {
    const ctx = this.ctx;
    const dpr = this.dpr;
    const tile = this.flipTile(glyph, w, h, surface);
    const sy = tile.y + Math.round(top * dpr);
    const sh = Math.round(bottom * dpr) - Math.round(top * dpr);
    if (angle === null) {
      ctx.drawImage(
        tile.canvas,
        tile.x,
        sy,
        tile.width,
        sh,
        Math.round(x * dpr) / dpr,
        Math.round(top * dpr) / dpr,
        tile.width / dpr,
        sh / dpr
      );
      return;
    }
    const strips = Math.min(
      FLAP_STRIPS_MAX,
      Math.max(1, Math.round((bottom - top) * dpr / FLAP_STRIP_PX))
    );
    const band = (bottom - top) / strips;
    const edgeA = projectRow(top, h, angle, FLIP_PERSPECTIVE).y;
    const edgeB = projectRow(bottom, h, angle, FLIP_PERSPECTIVE).y;
    if (Math.abs(edgeB - edgeA) * dpr < 1) return;
    for (let s = 0; s < strips; s++) {
      const y0 = top + band * s;
      const y1 = y0 + band;
      const a = projectRow(y0, h, angle, FLIP_PERSPECTIVE);
      const b = projectRow(y1, h, angle, FLIP_PERSPECTIVE);
      const scale = projectRow((y0 + y1) / 2, h, angle, FLIP_PERSPECTIVE).scale;
      const dy = Math.min(a.y, b.y);
      const dh = Math.abs(b.y - a.y);
      if (dh < 0.01) continue;
      const dw = w * scale;
      ctx.drawImage(
        tile.canvas,
        tile.x,
        tile.y + y0 * dpr,
        tile.width,
        band * dpr,
        x + (w - dw) / 2,
        dy,
        dw,
        dh + (dh * dpr >= 1 ? 0.35 : 0)
      );
    }
  }
  /** The glyph on its surface, a whole cell tall, as the atlas keeps it for this board's look. */
  flipTile(glyph, w, h, surface) {
    const style = this.style;
    const dpr = this.dpr;
    const width = Math.max(1, Math.round(w * dpr));
    const height = Math.max(1, Math.ceil(h * dpr));
    const centre = this.measured.centred || style.tabular && isDigit(glyph);
    const key = `${style.key}\0${style.color}\0${style.ascent}\0${surface}\0${centre}\0${width}\0${height}\0${dpr}\0${glyph}`;
    return atlasFor(this.host.ownerDocument).tile(
      key,
      width,
      height,
      (tctx) => {
        tctx.scale(dpr, dpr);
        tctx.fillStyle = surface;
        tctx.fillRect(0, 0, width / dpr, height / dpr);
        if (glyph === "") return;
        tctx.font = style.font;
        tctx.letterSpacing = style.letterSpacing;
        tctx.fillStyle = style.color;
        tctx.textBaseline = "alphabetic";
        const inset = centre ? (width / dpr - this.advance(glyph)) / 2 : 0;
        tctx.fillText(glyph, inset, style.ascent);
      }
    );
  }
  // Interruption: the old plan read at this instant.
  capturePresented(old, renderer, at) {
    const t = this.time(old, at);
    const h = this.style.lineHeight;
    const same = old.renderer === renderer;
    return old.plan.cells.map((cell, i) => {
      const state = presented(widthAt(old, i, t));
      if (same && isMoving(cell, old.window)) {
        const previous = old.presented[i];
        if (renderer === "drum") {
          for (const { glyph, y } of drumLayers(
            cell,
            t,
            h,
            resumeOffset(cell, previous, h)
          )) {
            const g = glyphOf(cell, glyph);
            if (!state.glyphYs.has(g)) state.glyphYs.set(g, y);
          }
        } else if (renderer === "flip") {
          const pose2 = flipPose(cell, t, previous);
          if (pose2.flapTopVisible) {
            state.topGlyph = glyphOf(cell, pose2.flapTop);
            state.topAngle = pose2.flapTopAngle;
          }
          if (pose2.flapBottomVisible) {
            state.bottomGlyph = glyphOf(cell, pose2.flapBottom);
            state.bottomAngle = pose2.flapBottomAngle;
          }
        } else {
          state.dimmed = isFlickering(cell, t, previous);
        }
      }
      return state;
    });
  }
};

// ---- paw-fx seams: mount / update / destroy -------------------------------

export const meta = {
  name: "split-flap",
  version: "1.0.0",
  category: "text",
  needs: [],
  license: "MIT",
  options: {
    transition: { type: "string", default: "flip", description: "How each letter changes: flip (hinged flaps), reel (a drum rolling through the alphabet), roll or scramble. Upstream's transition." },
    interval: { type: "number", default: 3200, min: 1200, max: 12000, step: 100, description: "Milliseconds each word stays up before every line turns to its next word. Ours: upstream turns on a new text, a section has nobody to set one." },
    duration: { type: "number", default: 650, min: 150, max: 3000, step: 50, description: "Milliseconds one cell takes to land. Upstream's DEFAULT_DURATION_MS." },
    stagger: { type: "number", default: 40, min: 0, max: 400, step: 10, description: "Milliseconds between neighbouring cells starting. Upstream's DEFAULT_STAGGER_MS." },
    cellWidth: { type: "string", default: "uniform", description: "uniform gives every cell the same width, a station board's fixed cells; natural lets each cell take its letter's width (reel and roll only, as upstream resolves it)." },
    direction: { type: "string", default: "down", description: "Which way the letters turn: down, up or random. Upstream's direction." },
    surfaceColor: { type: "string", default: "", description: "Colour a flap is painted on. Empty reads the line's own background, as upstream does; it must be opaque." },
  },
};

const DEFAULTS = {
  transition: "flip",
  interval: 3200,
  duration: DEFAULT_DURATION_MS,
  stagger: DEFAULT_STAGGER_MS,
  cellWidth: "uniform",
  direction: "down",
  surfaceColor: "",
};

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function mount(el, opts = {}) {
  const resting = { update() {}, destroy() {} };
  // No DOM, or a reader who asked for stillness: the words in the markup are
  // already the finished board, and a board that swaps them instantly every
  // few seconds is still motion.
  if (!el || typeof document === "undefined" || typeof el.querySelectorAll !== "function" || reducedMotion()) return resting;
  const hosts = [...el.querySelectorAll("[data-fx-flap]")];
  if (!hosts.length) return resting;

  let settings = { ...DEFAULTS, ...opts };
  const lines = hosts.map((host) => {
    const first = host.textContent.trim();
    const words = (host.getAttribute("data-fx-words") || "").split("|").map((w) => w.trim()).filter(Boolean);
    if (!words.includes(first)) words.unshift(first);
    return { host, words, index: words.indexOf(first), board: null, markup: host.innerHTML, style: host.getAttribute("style") };
  });

  const boardOptions = (line) => ({
    text: line.words[line.index],
    transition: settings.transition,
    duration: settings.duration,
    stagger: settings.stagger,
    cellWidth: settings.cellWidth,
    direction: settings.direction,
    surfaceColor: settings.surfaceColor || undefined,
    // The reduced-motion check happened above; under it no board exists.
    reduceMotion: "never",
  });

  let timer = 0;
  let observer = null;
  let visible = false;
  let started = false;
  let stopped = false;

  const tick = () => {
    for (const line of lines) {
      if (!line.board || line.words.length < 2) continue;
      line.index = (line.index + 1) % line.words.length;
      line.board.update(boardOptions(line));
    }
  };
  const schedule = () => {
    clearInterval(timer);
    timer = 0;
    if (!stopped && visible && started) timer = setInterval(tick, settings.interval);
  };

  // Upstream's animateOnMount: the first text rolls in from a blank board.
  // Not at load though, the first time the section is actually seen.
  const start = () => {
    if (started || stopped) return;
    started = true;
    for (const line of lines) line.board = new SplitflapBoard(line.host, boardOptions(line));
    el.setAttribute("data-fx-live", "");
    schedule();
  };

  if (typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver((entries) => {
      visible = entries[entries.length - 1].isIntersecting;
      if (visible) start();
      schedule();
    }, { threshold: 0.2 });
    observer.observe(el);
  } else {
    visible = true;
    start();
  }

  return {
    update(next = {}) {
      if (stopped) return;
      const interval = settings.interval;
      settings = { ...settings, ...next };
      for (const line of lines) line.board?.update(boardOptions(line));
      if (settings.interval !== interval) schedule();
    },
    destroy() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      observer?.disconnect();
      for (const line of lines) {
        line.board?.destroy();
        line.host.innerHTML = line.markup;
        if (line.style === null) line.host.removeAttribute("style");
        else line.host.setAttribute("style", line.style);
      }
      el.removeAttribute("data-fx-live");
    },
  };
}
