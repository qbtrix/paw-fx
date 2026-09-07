Stub vendor files for the build tests. The real `vendor/` is empty until the
vendoring task lands, so `buildItem(dir, vendorDir)` points here instead. The
manifest is always the shipped `vendor/manifest.json`, never a copy, so these
stubs cannot drift from the filenames the build actually emits.

Deliberately incomplete: only `three`'s files are stubbed here. A build test
asserts the error you get when a manifest file is missing from a vendor
directory, and it uses `tsparticles` to do it. Stubbing tsparticles here would
turn that test into a no-op, so leave it absent.
