// SPDX-License-Identifier: MIT
// fixture: imports a shared file that itself imports something, which the
// build refuses rather than silently shipping an item missing a file.
import { chained } from "../_shared/chained.js";
export const mount = () => chained();
