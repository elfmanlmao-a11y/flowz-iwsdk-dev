import { optimizeGLTF } from "@iwsdk/vite-plugin-gltf-optimizer";
import { injectIWER } from "@iwsdk/vite-plugin-iwer";
import { compileUIKit } from "@iwsdk/vite-plugin-uikitml";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

export default defineConfig(({ mode }) => ({
  base: "/", // USE "/" for Render static hosting. Use "/flowz-iwsdk-dev/" ONLY for GitHub Pages.
  plugins: [
    mkcert(),
    ...(mode === "development"
      ? [
          injectIWER({
            device: "metaQuest3",
            activation: "localhost",
            verbose: true,
          }),
        ]
      : []),
    compileUIKit({ sourceDir: "ui", outputDir: "public/ui", verbose: true }),
    optimizeGLTF({ level: "medium" }),
  ],
  server: {
    host: "0.0.0.0",
    port: 8081,
    open: true,
  },
  build: {
    outDir: "dist",
    sourcemap: mode !== "production",
    target: "esnext",
    rollupOptions: {
      input: "./index.html",
      output: {
        manualChunks: {
          iwsdk: ["@iwsdk/core"],
          three: ["three"],
        },
      },
    },
    assetsInlineLimit: 0, // Ensures all assets are emitted to dist
  },
  esbuild: { target: "esnext" },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
    esbuildOptions: { target: "esnext" },
  },
  publicDir: "public",
}));
