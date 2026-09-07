// fixture: a shared file that imports something else. The build refuses it,
// because emitting it would need a graph walk nothing needs yet.
import * as THREE from "../../vendor/three.module.js";
export const chained = () => THREE;
