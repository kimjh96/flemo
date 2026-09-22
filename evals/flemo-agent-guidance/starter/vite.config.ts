import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The scored build is a production build served from `dist`, so nothing here
// may depend on the dev server.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", sourcemap: false }
});
