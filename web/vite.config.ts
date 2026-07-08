import { defineConfig } from "vite";

// Static build for GitHub Pages (no backend). `base` is the project-page path
// (https://<user>.github.io/aim-rl-web-collector/); change it for a user page
// or custom domain.
export default defineConfig({
  base: "/aim-rl-web-collector/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
