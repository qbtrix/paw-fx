// gallery.js: filtering, deep links and the copy button for the paw-fx gallery.
// Copied verbatim into dist/registry/gallery/ by scripts/build-gallery.mjs.
//
// It holds no effect data and does no templating. Every card and every dialog
// is already in index.html, generated from dist/registry/, so the page is
// readable with scripting off and this file only hides, reorders and opens what
// is there. A classic script, not a module: the page is plain vanilla JS like
// the rest of the repo.
//
// Ranking mirrors the MCP server's search_effects (name exact, then name or
// tag, then summary or category), applied as CSS `order` so the grid predicts
// what an agent's search returns instead of inventing a second ordering.

(function () {
  "use strict";

  var grid = document.getElementById("fxg-grid");
  if (!grid) return;
  var cards = [].slice.call(grid.querySelectorAll(".fxg-card"));
  var q = document.getElementById("fxg-q");
  var freeOnly = document.getElementById("fxg-free");
  var count = document.getElementById("fxg-count");
  var empty = document.getElementById("fxg-empty");
  var tabs = [].slice.call(document.querySelectorAll(".fxg-tab"));
  var category = "";

  function rank(card, needle) {
    if (!needle) return 3;
    var name = card.dataset.name;
    if (name === needle) return 0;
    if (name.indexOf(needle) !== -1 || card.dataset.tags.indexOf(needle) !== -1) return 1;
    if (card.dataset.search.indexOf(needle) !== -1) return 2;
    return -1;
  }

  function apply() {
    var needle = (q && q.value || "").trim().toLowerCase();
    var shown = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var r = rank(card, needle);
      var ok =
        r !== -1 &&
        (!category || card.dataset.cat === category) &&
        (!freeOnly || !freeOnly.checked || card.dataset.deps === "0");
      card.hidden = !ok;
      card.style.order = r;
      if (ok) shown++;
    }
    if (count) count.textContent = shown + (shown === 1 ? " effect" : " effects");
    if (empty) empty.hidden = shown !== 0;
  }

  if (q) q.addEventListener("input", apply);
  if (freeOnly) freeOnly.addEventListener("change", apply);

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      category = tab.dataset.cat;
      tabs.forEach(function (t) { t.classList.toggle("is-on", t === tab); });
      apply();
    });
  });

  // The hero's second CTA is the same filter as the checkbox, so it flips the
  // checkbox rather than keeping a second piece of state.
  var freeCta = document.querySelector("[data-filter-free]");
  if (freeCta && freeOnly) {
    freeCta.addEventListener("click", function () {
      freeOnly.checked = true;
      apply();
    });
  }

  // ---- details ----

  function open(name) {
    var dialog = document.getElementById(name);
    if (!dialog || typeof dialog.showModal !== "function") return false;
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

  document.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest(".fxg-link") : null;
    if (!link) return;
    var name = link.getAttribute("href").slice(1);
    if (open(name)) {
      e.preventDefault();
      // Written, not navigated, so the deep link is shareable and the page does
      // not jump to the anchor underneath the modal.
      history.replaceState(null, "", "#" + name);
    }
  });

  document.querySelectorAll(".fxg-dialog").forEach(function (dialog) {
    dialog.addEventListener("close", function () {
      if (location.hash.slice(1) === dialog.id) history.replaceState(null, "", location.pathname + location.search);
    });
    // Clicking the backdrop closes: the sheet fills the dialog, so a click that
    // lands on the dialog itself landed outside the sheet.
    dialog.addEventListener("click", function (e) {
      if (e.target === dialog) dialog.close();
    });
  });

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

  // The MCP server hands agents a preview_url of <gallery>#<effect>, so a hash
  // on load has to land on that effect's panel.
  window.addEventListener("hashchange", function () {
    if (location.hash.length > 1) open(location.hash.slice(1));
  });
  if (location.hash.length > 1) open(location.hash.slice(1));

  apply();
})();
