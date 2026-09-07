// gallery.js: filtering, the sidebar, deep links, the search shortcut and the
// copy button for the paw-fx gallery. Copied verbatim into
// dist/registry/gallery/ by scripts/build-gallery.mjs.
//
// It holds no effect data and does no templating. Every card, every nav row and
// every dialog is already in index.html, generated from dist/registry/, so the
// page is readable with scripting off and this file only hides, reorders,
// opens and counts what is there. A classic script, not a module: the page is
// plain vanilla JS like the rest of the repo.
//
// THE HASH IS THE VIEW. One grammar covers both jobs the fragment has to do:
//
//   #<effect-name>        open that effect's panel (the MCP server's
//                         preview_url contract, so it cannot change)
//   #cat=<category>       filter the grid to a category
//   #free                 filter to the dependency-free effects
//   #cat=text&free        both, because the old page let them stack
//
// A bare token is an effect id and a `k=v` token is a filter, so the only name
// that could shadow a filter is an effect literally called "free"; the
// generator throws on one rather than leaving it to be discovered. Filter links
// are plain anchors that let the
// browser navigate, and `hashchange` is the only place the view is read; the
// panel is opened with replaceState instead, so opening one does not bury the
// filter behind a history entry. Closing a panel puts the filter hash back
// rather than the bare path, or a shared link would come back to a view the
// sender was not looking at.
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
  var picks = [].slice.call(document.querySelectorAll(".fxg-pick"));
  var tallies = [].slice.call(document.querySelectorAll("[data-n]"));

  var view = { cat: "", free: false };
  var lastFilter = "";

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
  }

  function expand(pick, on) {
    var row = pick.closest && pick.closest(".fxg-row");
    var twist = row && row.querySelector(".fxg-twist");
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

  // Puts the browsing view back in the address bar when a panel closes, so a
  // link copied afterwards is the grid the visitor is looking at rather than
  // the effect they just shut. Guarded on the hash still naming this panel,
  // which makes it a no-op when the hash has ALREADY moved on -- that is what
  // lets sync() close a stale panel without fighting the navigation that
  // triggered it. The guard is a state check rather than a "closing on
  // purpose" flag on purpose: a dialog's close event is a queued task, not a
  // synchronous call, so a flag set and cleared around .close() is always back
  // to false by the time the handler reads it.
  function restore(id) {
    if (location.hash.slice(1) !== id) return;
    history.replaceState(null, "", lastFilter || location.pathname + location.search);
  }

  function openPanel(name) {
    var dialog = document.getElementById(name);
    if (!dialog || !dialog.classList.contains("fxg-dialog") || typeof dialog.showModal !== "function") return false;
    // The dialog's shot is filled from the card's image: the same data: URI is
    // already decoded, so a second copy in the markup would double the page for
    // no picture.
    var slot = dialog.querySelector("[data-shot]");
    if (slot && !slot.firstChild) {
      var img = grid.querySelector('.fxg-card[data-name="' + name + '"] .fxg-shot');
      if (img) slot.appendChild(img.cloneNode());
    }
    if (!dialog.open) dialog.showModal();
    return true;
  }

  function sync() {
    var h = parseHash();
    var open = document.querySelectorAll(".fxg-dialog[open]");
    for (var i = 0; i < open.length; i++) if (open[i].id !== h.open) open[i].close();
    if (h.open) {
      // A panel hash leaves the filters alone, so closing it comes back to the
      // view the visitor was browsing.
      openPanel(h.open);
      return;
    }
    view.cat = h.cat;
    view.free = h.free;
    lastFilter = filterHash();
    markNav();
    apply();
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

  if (q) {
    q.addEventListener("input", apply);
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

  // ---- panels ----

  document.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest(".fxg-open") : null;
    if (!link) return;
    var name = link.getAttribute("href").slice(1);
    if (!openPanel(name)) return;
    e.preventDefault();
    // Written, not navigated, so the deep link is shareable and the filter
    // behind the panel is one replaceState away rather than one entry back.
    history.replaceState(null, "", "#" + name);
    if (nav && nav.classList.contains("is-open")) setDrawer(false, false);
  });

  // EVERY exit from a panel restores the hash, not only the `close` event.
  // `close` is the tidy hook and stays here as the catch-all, but it is not
  // dependable enough to be the only one: it needs a frame to arrive. In a
  // headless browser whose animation timeline does not advance -- which is how
  // this repo captures previews, and how the page was proven -- Escape closes
  // the dialog and fires `cancel` while `close` never lands at all, so a page
  // that hangs its cleanup on it hands out links to panels the visitor already
  // shut. Each of the three exits this page owns therefore calls restore()
  // itself, and because restore() no-ops once the hash has moved on, wiring all
  // of them costs nothing and needs no agreement about which one ran.
  var dialogs = document.querySelectorAll(".fxg-dialog");
  for (var d = 0; d < dialogs.length; d++) {
    (function (dialog) {
      dialog.addEventListener("close", function () { restore(dialog.id); });
      dialog.addEventListener("cancel", function () { restore(dialog.id); });
      // Clicking the backdrop closes: the sheet fills the dialog, so a click
      // that lands on the dialog itself landed outside the sheet.
      dialog.addEventListener("click", function (e) {
        if (e.target !== dialog) return;
        dialog.close();
        restore(dialog.id);
      });
    })(dialogs[d]);
  }

  // The panel's Close button submits a method="dialog" form, which closes with
  // no cancel. The click bubbles here while the hash still names the panel.
  document.addEventListener("click", function (e) {
    var x = e.target.closest ? e.target.closest(".fxg-x") : null;
    var panel = x && x.closest(".fxg-dialog");
    if (panel) restore(panel.id);
  });

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
