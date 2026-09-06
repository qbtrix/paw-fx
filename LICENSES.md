# Licences

paw-fx itself is MIT. Every ported effect keeps its upstream licence; the
allow-list is MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, Unlicense, CC0-1.0.
Ported files carry the upstream copyright header, as a comment, in `index.js`,
and cite `repo`, `commit` and `path` in `meta.json.origin`.

Vendored libraries are declared in `vendor/manifest.json` ahead of the files
themselves landing: each key records its licence and the `licenseFiles` that
have to travel with the code into every generated site. `paper` is Apache-2.0,
so it ships a NOTICE as well as the licence (section 4(d)). Add a row here as
each one lands.

| Effect / vendor | Licence | Upstream |
|---|---|---|
| aurora-css | MIT | paw-fx (original) |
