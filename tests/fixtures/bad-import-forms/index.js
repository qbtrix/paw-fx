// fixture: every module specifier form must fail lint, one form per line with
// its own specifier so a test can name exactly which form regressed. The first
// three lines are the review probe verbatim -- all three passed the old
// from-only scan. Semicolons are deliberate: they stop the binding scan at the
// statement boundary, so each specifier below is caught by one pattern only.
import "animejs";
export * from "three";
const dynamic = await import("lenis");
import defaultOnly from "fx-default";
import { named } from "fx-named";
import * as namespace from "fx-namespace";
import mixedDefault, { mixedNamed } from "fx-mixed";
export { reexported } from "fx-reexport-named";
import {
  multi,
  line as aliased,
} from "fx-multiline";
// control: a relative path is a real file in the generated site, never flagged.
import "./local.js";

export function mount(el) {
  if (!el) return { update() {}, destroy() {} };
  void [dynamic, defaultOnly, named, namespace, mixedDefault, mixedNamed, multi, aliased];
  return { update() {}, destroy() {} };
}
