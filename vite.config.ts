import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

// GitHub Pages serve o projeto em /aerodesign-manager/.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/aerodesign-manager/" : "/",
  plugins: [preact()],
  // Phaser sozinho tem ~1,2 MB minificado; o aviso padrão de 500 kB não ajuda aqui.
  build: { chunkSizeWarningLimit: 1600 },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
}));
