# extract-panels.py -- pull the three author panels out of a CodePen fullpage
# wrapper and concatenate them into one snapshot file for paw-fx's snapshot
# origin gate.
#
# WHY NOT HASH THE WRAPPER. cdpn.io/<user>/fullpage/<slug> is CodePen's page
# around the pen, not the pen: content-hashed asset URLs, a referer warning,
# CodePen's own stylesheets and a stopExecutionOnTimeout guard script. Its bytes
# move whenever CodePen redeploys -- measured: the filipz wrapper hashed
# 8b7bfd1c... on 2026-09-07 05:34Z in an earlier survey and 2e85b1ec... here,
# 76203 bytes against 76081. Pinning that would false-fail on CodePen's churn
# and diff against code the author never wrote.
#
# WHAT IS PINNED INSTEAD. The author's HTML, CSS and JS panels, taken out of the
# srcdoc document the wrapper embeds, concatenated in that fixed order behind
# labelled delimiters, with an MIT notice header. Three transformations, all
# mechanical, all declared in the header of each snapshot:
#   1. CodePen's loop guards are stripped. `window.CP.shouldStopExecution(n)` /
#      `window.CP.exitedLoop(n)` are injected by CodePen's compiler, not written
#      by the author.
#   2. base64 image data URIs are replaced by a token. An embedded photograph is
#      the author's content under separate rights, not their code, and paw-fx
#      does not redistribute photography.
#   3. CodePen's own <style>/<script> tags inside the srcdoc (cpwebassets,
#      codepenassets, the stopExecution guard, the import-map shim) are dropped.
import re, html, sys, hashlib, pathlib

CP_GUARD = re.compile(
    r"(?:if\s*\(\s*window\.CP\.shouldStopExecution\(\s*\d+\s*\)\s*\)\s*break;\s*"
    r"|window\.CP\.exitedLoop\(\s*\d+\s*\);\s*)"
)
B64 = re.compile(r"data:image/[a-zA-Z.+-]+;base64,[A-Za-z0-9+/=\s]{200,}")
CODEPEN_HOST = re.compile(r"cpwebassets|codepenassets|stopExecutionOnTimeout")
# CodePen prepends this console shim to every compiled JS panel.
CP_CONSOLE = re.compile(r"^\s*window\.console\s*=\s*window\.console\s*\|\|\s*function\([^)]*\)\s*\{\};\s*")


def inner_document(wrapper_text):
    """The srcdoc document CodePen embeds -- the pen as the browser runs it."""
    m = re.search(r'srcdoc="(.*?)"\s*(?:sandbox|allow|id|class|title|>)', wrapper_text, re.S)
    if not m:
        raise SystemExit("no srcdoc found")
    return html.unescape(m.group(1))


def panels(doc):
    styles = [s for s in re.findall(r"<style[^>]*>(.*?)</style>", doc, re.S) if not CODEPEN_HOST.search(s)]
    js = ""
    for attrs, code in re.findall(r"<script([^>]*)>(.*?)</script>", doc, re.S):
        if CODEPEN_HOST.search(attrs) or CODEPEN_HOST.search(code):
            continue
        if "src=" in attrs and "rendered-js" not in attrs:
            continue
        if not code.strip():
            continue
        js += code
    body = re.search(r"<body[^>]*>(.*?)</body>", doc, re.S)
    markup = body.group(1) if body else ""
    # The author's markup, minus every <script> the page carries (they are the
    # JS panel, or CodePen's, and both are handled above).
    markup = re.sub(r"<script[\s\S]*?</script>", "", markup)
    return markup.strip(), "\n".join(s.strip() for s in styles), js.strip()


def build(pen_url, wrapper_path, out_path, retrieved, author, title):
    raw = pathlib.Path(wrapper_path).read_bytes()
    doc = inner_document(raw.decode("utf-8", "replace"))
    markup, css, js = panels(doc)
    js = CP_CONSOLE.sub("", CP_GUARD.sub("", js))
    n_b64 = len(B64.findall(js)) + len(B64.findall(markup)) + len(B64.findall(css))
    js = B64.sub("data:image/jpeg;base64,PHOTOGRAPH-REMOVED", js)
    markup = B64.sub("data:image/jpeg;base64,PHOTOGRAPH-REMOVED", markup)
    css = B64.sub("data:image/jpeg;base64,PHOTOGRAPH-REMOVED", css)

    header = f"""=== paw-fx upstream snapshot ===================================================
source        {pen_url}
title         {title}
author        {author}
retrieved     {retrieved}
wrapper       https://cdpn.io/{pen_url.split('/')[3]}/fullpage/{pen_url.rsplit('/', 1)[1]}
wrapper bytes {len(raw)}
wrapper sha256 {hashlib.sha256(raw).hexdigest()}

The MIT Licence, as CodePen prints it at
{pen_url.replace('/pen/', '/details/')}:

  Copyright (c) 2026 by {author} ({pen_url})

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.

WHAT THIS FILE IS. A pen has no commit, so paw-fx pins a committed copy of the
source it ported from and the gate hashes this file. The three author panels
below are taken out of the srcdoc document inside the wrapper named above --
never the wrapper itself, whose bytes carry CodePen's content-hashed asset URLs
and move on CodePen's own redeploys.

Panels appear in this fixed order: HTML, then CSS, then JS, each behind a
--- <PANEL> --- delimiter line.

Three transformations, all mechanical, applied by scripts/extract-panels.py:
  1. CodePen's injected loop guards are removed. `window.CP.shouldStopExecution`
     and `window.CP.exitedLoop` are added by CodePen's compiler; the author never
     wrote them.
  2. base64 image data URIs are replaced by the literal token
     `data:image/jpeg;base64,PHOTOGRAPH-REMOVED`. {n_b64} was/were replaced here.
     An embedded photograph is content under separate rights, not code, and
     paw-fx redistributes no photography.
  3. CodePen's own injections are dropped: its <style>/<script> tags inside the
     srcdoc (cpwebassets, codepenassets, stopExecutionOnTimeout), the
     `window.console = window.console || function()...;` shim it prepends to
     every compiled JS panel, and every <script> tag in the HTML panel -- the
     script IS the JS panel below.
===============================================================================

--- HTML ---
{markup}

--- CSS ---
{css}

--- JS ---
{js}
"""
    pathlib.Path(out_path).write_text(header)
    print(f"{out_path}\n  bytes  {len(header.encode())}\n  sha256 {hashlib.sha256(header.encode()).hexdigest()}")
    print(f"  panels html={len(markup)} css={len(css)} js={len(js)} b64-stripped={n_b64}")


if __name__ == "__main__":
    build(
        "https://codepen.io/damarberlari/pen/pvgKamj",
        "wrapper-damarberlari-pvgKamj.html",
        sys.argv[1] if len(sys.argv) > 1 else "damarberlari-pvgKamj.snapshot.txt",
        "2026-09-07",
        "damarberlari",
        "Dithering - Part 1",
    )
    build(
        "https://codepen.io/filipz/pen/JoGNQzm",
        "wrapper-filipz-JoGNQzm.html",
        sys.argv[2] if len(sys.argv) > 2 else "filipz-JoGNQzm.snapshot.txt",
        "2026-09-07",
        "Filip Zrnzevic",
        "[threejs/gsap] Liquid Morphology Slideshow",
    )
