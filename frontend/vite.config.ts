import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // import.meta.dirname statt __dirname: der Config-Lader von Vite
      // meldet __dirname sonst als kuenftig nicht mehr unterstuetzt.
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Die Tokenschicht wird ueber tokens.test.ts gegen die Quelldatei
    // geprueft, nicht ueber gerendertes CSS. Tailwind im Testlauf zu
    // uebersetzen kostet Zeit und belegt nichts zusaetzlich.
    css: false,
  },
})
