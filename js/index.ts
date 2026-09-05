import path from "node:path";
import Core from "./core.js";

const rootDir = path.resolve(__dirname, "../..");
new Core(rootDir).start();
