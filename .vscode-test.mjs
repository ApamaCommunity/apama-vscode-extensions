import { defineConfig } from "@vscode/test-cli";
import * as path from "path";

export default defineConfig({
  files: "out/test/**/*.test.js",
  // Use our custom test runner
  entryPoint: "out/test/runTest.js"
});
