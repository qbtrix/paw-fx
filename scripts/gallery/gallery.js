// gallery.js: the two views, the one live frame, filtering, the sidebar, deep
// links, the search shortcut and the copy button for the paw-fx gallery. Copied
// verbatim into dist/registry/gallery/ by scripts/build-gallery.mjs.
//
// It holds no effect data and does no templating. Every card, every nav row and
// every detail panel is already in index.html, generated from dist/registry/,
// so the page is readable with scripting off and this file only hides,
// reorders, counts and points one frame at one demo. A classic script, not a
// module: the page is plain vanilla JS like the rest of the repo.
//
// THE HASH IS THE VIEW. One grammar covers both jobs the fragment has to do:
//
//   #<effect-name>        run that effect in the stage (the MCP server's
//                         preview_url contract, so it cannot change)
//   #cat=<category>       filter the grid to a category
//   #free                 filter to the dependency-free effects
//   #cat=text&free        both, because the old page let them stack
//
// A bare token is an effect id and a `k=v` token is a filter, so the only name
// that could shadow a filter is an effect literally called "free"; the
// generator throws on one rather than leaving it to be discovered. Every link
// is a plain anchor the browser navigates, and `hashchange` is the only place
// the view is read, which is what makes the browser's Back button the way out
// of the stage and costs no code at all. A fragment naming NEITHER an effect
// nor a filter -- the skip link's #fxg-grid, anything a reader typed -- changes
// nothing, so an in-page jump never silently clears the filters.
//
// A stage hash leaves the filters alone, so the way back is the filtered grid
// the visitor was browsing rather than all 98. That is what #fxg-back's href is
// rewritten to on every pick.
//
// ONE FRAME, REPLACED NOT RE-POINTED. The stage runs the effect inside an
// <iframe> on demo/<name>.html, and switching effects removes the frame element
// and appends a fresh one. Removing it discards the nested browsing context,
// which releases the WebGL context with it -- a guarantee no destroy() call can
// match -- and it keeps the parent's history clean, which re-pointing .src does
// not. The frame is created on the first pick and never exists before it, so
// opening the gallery starts no context nobody asked for.
//
// Ranking mirrors the MCP server's search_effects (name exact, then name or
// tag, then summary or category), applied as CSS `order` so the grid predicts
// what an agent's search returns instead of inventing a second ordering.
//
// The sidebar counts are FACETS OF THE SEARCH ONLY, never of the category or
// the dependency filter. Search "shader" and every row tells you how many hits
// it holds, which is the question a reader has at that moment; folding the
// active category into the counts would zero the other eight rows and turn the
// map of the library into a readout of the one road already taken.

(function () {
  "use strict";

  var grid = document.getElementById("fxg-grid");
  if (!grid) return;

  var cards = [].slice.call(grid.querySelectorAll(".fxg-card"));
  var q = document.getElementById("fxg-q");
  var count = document.getElementById("fxg-count");
  var title = document.getElementById("fxg-title");
  var empty = document.getElementById("fxg-empty");
  var emptyQ = document.getElementById("fxg-empty-q");
  var clear = document.getElementById("fxg-clear");
  var nav = document.getElementById("fxg-nav");
  var burger = document.getElementById("fxg-burger");
  var scrim = document.getElementById("fxg-scrim");
  var main = document.getElementById("fxg-main");
  var browse = document.getElementById("fxg-browse");
  var stage = document.getElementById("fxg-stage");
  var frameBox = document.getElementById("fxg-frame-box");
  var back = document.getElementById("fxg-back");
  var now = document.getElementById("fxg-stage-now");
  var say = document.getElementById("fxg-say");
  var picks = [].slice.call(document.querySelectorAll(".fxg-pick"));
  var navOpens = nav ? [].slice.call(nav.querySelectorAll(".fxg-open")) : [];
  var tallies = [].slice.call(document.querySelectorAll("[data-n]"));

  var view = { cat: "", free: false };
  var running = "";

  // ---- filtering ----

  function rank(card, needle) {
    if (!needle) return 3;
    var name = card.dataset.name;
    if (name === needle) return 0;
    if (name.indexOf(needle) !== -1 || card.dataset.tags.indexOf(needle) !== -1) return 1;
    if (card.dataset.search.indexOf(needle) !== -1) return 2;
    return -1;
  }

  function label() {
    var bits = [];
    if (view.cat) bits.push(view.cat);
    if (view.free) bits.push("runs on every engine");
    return bits.length ? bits.join(" and ") : "All effects";
  }

  function apply() {
    var needle = ((q && q.value) || "").trim().toLowerCase();
    var shown = 0;
    var hits = 0;
    var free = 0;
    var per = {};

    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var r = rank(card, needle);
      var hit = r !== -1;
      if (hit) {
        hits++;
        per[card.dataset.cat] = (per[card.dataset.cat] || 0) + 1;
        if (card.dataset.deps === "0") free++;
      }
      var ok =
        hit &&
        (!view.cat || card.dataset.cat === view.cat) &&
        (!view.free || card.dataset.deps === "0");
      card.hidden = !ok;
      card.style.order = r;
      if (ok) shown++;
    }

    for (var j = 0; j < tallies.length; j++) {
      var node = tallies[j];
      var key = node.dataset.n;
      var n = key === "*" ? hits : key === "+free" ? free : per[key] || 0;
      node.textContent = n;
      var row = node.closest && node.closest(".fxg-row");
      if (row) row.classList.toggle("is-empty", n === 0);
    }

    if (title) title.textContent = label();
    if (count) count.textContent = shown + (shown === 1 ? " effect" : " effects");
    if (empty) empty.hidden = shown !== 0;
    if (emptyQ) emptyQ.textContent = needle ? " " + needle : "";
    if (clear) clear.hidden = !needle && !view.cat && !view.free;
  }

  function markNav() {
    for (var i = 0; i < picks.length; i++) {
      var p = picks[i];
      var role = p.dataset.role;
      var on =
        role === "all"
          ? !view.cat && !view.free
          : role === "free"
            ? view.free
            : p.dataset.cat === view.cat;
      if (on) p.setAttribute("aria-current", "true");
      else p.removeAttribute("aria-current");
      // The group holding the view you are looking at opens itself, so the
      // sidebar shows what is in the category rather than only its name.
      if (on && role === "cat") expand(p, true);
    }

    // The effect on the stage is marked in the list too, or a two-pane explorer
    // has no selected row and a cold deep link arrives with its own name buried
    // in a collapsed group.
    for (var k = 0; k < navOpens.length; k++) {
      var link = navOpens[k];
      if (link.getAttribute("href") !== "#" + running) {
        link.removeAttribute("aria-current");
        continue;
      }
      link.setAttribute("aria-current", "true");
      expand(link, true);
      if (link.scrollIntoView) link.scrollIntoView({ block: "nearest" });
    }
  }

  // Takes any node inside a sidebar group -- the category link in the row, or
  // one effect link in the list under it -- and opens that group.
  function expand(node, on) {
    var group = node.closest && node.closest(".fxg-group");
    var twist = group && group.querySelector(".fxg-twist");
    if (!twist) return;
    var sub = document.getElementById(twist.getAttribute("aria-controls"));
    if (!sub) return;
    twist.setAttribute("aria-expanded", on ? "true" : "false");
    sub.hidden = !on;
  }

  // ---- the hash ----

  function parseHash() {
    var raw = (location.hash || "").replace(/^#/, "");
    var out = { cat: "", free: false, open: "" };
    if (!raw) return out;
    var parts = raw.split("&");
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (part === "free") out.free = true;
      else if (part.slice(0, 4) === "cat=") out.cat = decodeURIComponent(part.slice(4));
      else out.open = part;
    }
    return out;
  }

  function filterHash() {
    var parts = [];
    if (view.cat) parts.push("cat=" + encodeURIComponent(view.cat));
    if (view.free) parts.push("free");
    return parts.length ? "#" + parts.join("&") : "";
  }

  // ---- the stage ----

  // Removing the element, not re-pointing .src. Removing discards the nested
  // browsing context, so the demo's document, its timers and its WebGL context
  // go with it; re-pointing .src leaves the teardown to the browser's
  // navigation path AND writes a history entry into the parent for every
  // switch. This is also the only teardown on the page, so leaving the stage
  // calls it with no name.
  function runFrame(name) {
    var old = frameBox.querySelector("iframe");
    if (old) old.remove();
    if (!name) return;
    var frame = document.createElement("iframe");
    frame.className = "fxg-frame";
    // Named, because a frame with no accessible name is announced as "frame"
    // and there are 98 of those on this site.
    frame.title = name + ", running";
    frame.src = "demo/" + encodeURIComponent(name) + ".html";
    frameBox.appendChild(frame);
  }

  // The still preview under the frame, cloned from the card rather than
  // rendered a second time into the markup. It shows for the moment the demo
  // takes to load and is covered by it after, which is the resting state the
  // pane would otherwise spend that moment as a black rectangle.
  function setPoster(name) {
    var slot = frameBox.querySelector("[data-shot]");
    if (!slot) return;
    slot.textContent = "";
    var img = grid.querySelector('.fxg-card[data-name="' + name + '"] .fxg-shot');
    if (img) slot.appendChild(img.cloneNode());
  }

  function showStage(name, panel) {
    running = name;

    var panels = stage.querySelectorAll(".fxg-detail");
    for (var i = 0; i < panels.length; i++) panels[i].hidden = panels[i] !== panel;

    setPoster(name);
    runFrame(name);
    if (now) now.textContent = "Running " + name;
    if (say) say.textContent = "Now running " + name;
    if (back) back.setAttribute("href", filterHash() || "#");

    browse.hidden = true;
    stage.hidden = false;
    markNav();

    // Arriving from a card means the thing that had focus is now inside a
    // hidden subtree, and focus falls to <body>. Arriving from the sidebar
    // means the list still has it and the next pick should be one key away, so
    // that focus is left exactly where it is. preventScroll because the heading
    // sits under the frame and pulling it into view would push the running
    // effect off the top of the pane.
    var active = document.activeElement;
    if (!nav || !nav.contains(active)) {
      var title = panel.querySelector(".fxg-dtitle");
      if (title) title.focus({ preventScroll: true });
    }
    // The fragment jump already happened against a panel that was hidden at the
    // time, so nothing scrolled and the page is still wherever it was: down the
    // grid on the way in, or down the previous effect's options table on a
    // switch. Either way the visitor asked to watch THIS effect, so the frame
    // is what they get to see.
    window.scrollTo(0, 0);
  }

  function showBrowse() {
    running = "";
    runFrame("");
    stage.hidden = true;
    browse.hidden = false;
  }

  function sync() {
    var h = parseHash();
    var panel = h.open ? document.getElementById(h.open) : null;
    if (panel && !panel.classList.contains("fxg-detail")) panel = null;

    // A fragment that names neither an effect nor a filter is an in-page jump
    // (the skip link's #fxg-grid) or a typo. Either way it is not a view, so
    // nothing here touches one.
    if (h.open && !panel) return;

    if (panel) {
      // A stage hash leaves the filters alone, so the way back is the grid the
      // visitor was browsing rather than all 98.
      showStage(h.open, panel);
    } else {
      if (!stage.hidden) showBrowse();
      view.cat = h.cat;
      view.free = h.free;
      markNav();
      apply();
    }
    if (nav && nav.classList.contains("is-open")) setDrawer(false);
  }

  // ---- the drawer ----

  function focusables(root) {
    var all = root.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])');
    var out = [];
    for (var i = 0; i < all.length; i++) if (all[i].getClientRects().length) out.push(all[i]);
    return out;
  }

  // restoreFocus, not `restore`: a parameter called restore would shadow the
  // hash-restoring function of that name for the whole body.
  function setDrawer(on, restoreFocus) {
    if (!nav || !burger) return;
    nav.classList.toggle("is-open", on);
    burger.setAttribute("aria-expanded", on ? "true" : "false");
    if (scrim) scrim.hidden = !on;
    document.body.classList.toggle("fxg-locked", on);
    // Everything behind the drawer goes inert, so a screen reader and the
    // pointer see the same modal the sighted keyboard user is trapped in.
    if (main) {
      if (on) main.setAttribute("inert", "");
      else main.removeAttribute("inert");
    }
    if (on) {
      // Reading a layout property flushes the style change above, so the panel
      // is already visible by the time focus() decides whether it can take it.
      void nav.offsetWidth;
      var f = focusables(nav);
      (f[0] || nav).focus();
    } else if (restoreFocus !== false) {
      burger.focus();
    }
  }

  if (burger) {
    burger.addEventListener("click", function () {
      setDrawer(!nav.classList.contains("is-open"));
    });
  }
  if (scrim) scrim.addEventListener("click", function () { setDrawer(false); });

  var closeBtn = document.getElementById("fxg-nav-close");
  if (closeBtn) closeBtn.addEventListener("click", function () { setDrawer(false); });

  if (nav) {
    nav.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !nav.classList.contains("is-open")) return;
      var f = focusables(nav);
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
  }

  // Grown past the breakpoint with the drawer open: the panel is part of the
  // page again, so the lock and the inert have to come off with it.
  try {
    window.matchMedia("(min-width: 901px)").addEventListener("change", function (e) {
      if (e.matches) setDrawer(false, false);
    });
  } catch (e) {}

  // ---- search ----

  // Typing is a browse action, so it leaves the stage: filtering a grid the
  // visitor cannot see looks like a search box that does nothing. replaceState
  // rather than a navigation, because the effect they just left is not a place
  // Back should return them to mid-search, and it fires no hashchange, so
  // sync() is called by hand.
  function leaveStage() {
    if (stage.hidden) return;
    history.replaceState(null, "", filterHash() || location.pathname + location.search);
    sync();
  }

  if (q) {
    q.addEventListener("input", function () {
      leaveStage();
      apply();
    });
    q.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      // Firefox does not clear a type=search on Escape, and the grid has to be
      // refiltered either way. Kept off the document handler so it does not
      // also close the drawer.
      e.stopPropagation();
      q.value = "";
      apply();
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (nav && nav.classList.contains("is-open")) setDrawer(false);
      return;
    }
    if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || !q) return;
    var t = e.target;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    e.preventDefault();
    q.focus();
    q.select();
  });

  if (clear) {
    clear.addEventListener("click", function () {
      if (q) q.value = "";
      // The href is "#", so the hash change does the filters and apply() runs
      // from sync(). This only has to deal with the search box, which the hash
      // does not carry.
      if (!location.hash) apply();
    });
  }

  // Nothing intercepts a click on an effect link. They are plain anchors to
  // "#<name>", so the browser navigates, writes the history entry and fires
  // `hashchange`, and sync() does the rest. That is what makes Back the way out
  // of the stage without a line of code deciding so, and it is why picking an
  // effect from the sidebar, from a card, or from a link somebody pasted all
  // land in exactly the same place.

  // ---- groups ----

  document.addEventListener("click", function (e) {
    var twist = e.target.closest ? e.target.closest(".fxg-twist") : null;
    if (!twist) return;
    var sub = document.getElementById(twist.getAttribute("aria-controls"));
    if (!sub) return;
    var on = twist.getAttribute("aria-expanded") === "true";
    twist.setAttribute("aria-expanded", on ? "false" : "true");
    sub.hidden = on;
  });

  // ---- copy ----

  document.addEventListener("click", function (e) {
    var button = e.target.closest ? e.target.closest(".fxg-copy") : null;
    if (!button || !navigator.clipboard) return;
    var code = document.getElementById(button.dataset.copy);
    if (!code) return;
    navigator.clipboard.writeText(code.textContent).then(function () {
      button.textContent = "Copied";
      setTimeout(function () { button.textContent = "Copy"; }, 1400);
    });
  });

  window.addEventListener("hashchange", sync);
  sync();
})();
