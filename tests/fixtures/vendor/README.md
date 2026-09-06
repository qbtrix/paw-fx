Stub vendor files for the build tests. The real `vendor/` is empty until the
vendoring task lands, so `buildItem(dir, vendorDir)` points here instead. The
manifest is always the shipped `vendor/manifest.json`, never a copy, so these
stubs cannot drift from the filenames the build actually emits.
