import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Everything (JS, CSS) is inlined into dist/index.html so the viewer is a single file that opens
// from disk, no server needed. Data is never bundled: it is loaded by drag-and-drop at runtime.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
});
