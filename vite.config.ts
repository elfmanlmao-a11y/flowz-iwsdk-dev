import { optimizeGLTF } from "@iwsdk/vite-plugin-gltf-optimizer";
import { injectIWER } from "@iwsdk/vite-plugin-iwer";
import { compileUIKit } from "@iwsdk/vite-plugin-uikitml";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";

export default defineConfig(({ mode }) => ({
  base: "/flowz-iwsdk-dev/",  // Ensures relative paths for GitHub Pages

  plugins: [
    mkcert(),
    
    // Conditionally enable IWSDK plugins only in development
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
    optimizeGLTF({
      level: "medium",
    }),
  ],

  server: { 
    host: "0.0.0.0", 
    port: 8081, 
    open: true 
  },

  build: {
    outDir: "dist",
    sourcemap: mode !== "production",  // Disable in production for smaller files
    target: "esnext",
    rollupOptions: { 
      input: "./index.html",
      output: {
        // Bundle IWSDK and Three.js for better caching
        manualChunks: {
          iwsdk: ["@iwsdk/core"],
          three: ["three"],
        },
      },
    },
    // Ensure all assets are copied correctly
    assetsInlineLimit: 0,  // Prevent inlining for GLTF/JSON files
  },

  esbuild: { target: "esnext" },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
    esbuildOptions: { target: "esnext" },
  },
  publicDir: "public",
}));