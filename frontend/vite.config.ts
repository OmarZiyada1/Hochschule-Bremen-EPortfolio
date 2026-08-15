import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Ziel des Entwicklungs-Proxys. Auf dem Host das lokale Backend, im
// Compose-Netz der Dienstname (gesetzt in docker-compose.override.yml).
const proxyTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:8080"

// Im Container gesetzt. Bind Mounts von Windows melden keine Dateiereignisse
// in den Container, ohne Polling bliebe der Hot Reload dort stumm. Auf dem
// Host bleibt Polling aus, es kostet dauerhaft Rechenzeit.
const inContainer = process.env.DOCKER_CONTAINER === "1"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // true bindet an 0.0.0.0. Der Default 127.0.0.1 waere aus dem Container
    // heraus nicht erreichbar.
    host: true,
    // Fest, weil CORS_ALLOWED_ORIGINS und app.mail.base-url auf 5173 zeigen:
    // ein stilles Ausweichen auf 5174 wuerde beides ins Leere laufen lassen.
    port: 5173,
    strictPort: true,
    // Ein Origin: die API laeuft ueber den Dev-Server. Damit sieht der
    // Browser keinen fremden Ursprung, es gibt kein CORS, und der Code
    // braucht keine Basis-URL, die zur Bauzeit ins Bundle wandert.
    proxy: {
      "/api": { target: proxyTarget, changeOrigin: true },
      "/v3/api-docs": { target: proxyTarget, changeOrigin: true },
    },
    watch: {
      usePolling: inContainer,
      // Polling kostet pro Datei und Durchlauf einen Zugriff, und ueber einen
      // Bind Mount von Windows ist jeder davon teuer. Ohne die Ausschluesse
      // laesst der Watcher den Container dauerhaft bei ueber 60 Prozent CPU
      // laufen, bis der Dev-Server keine Anfragen mehr beantwortet.
      // .pnpm-store entsteht auf dem Host, wenn das Projekt auf einem anderen
      // Laufwerk liegt als der globale Paketspeicher, und bringt allein
      // Hunderttausende Dateien mit.
      ignored: [
        "**/node_modules/**",
        "**/.pnpm-store/**",
        "**/dist/**",
        "**/.git/**",
      ],
      // Zwei Zehntelsekunden reichen fuer den Hot Reload und sind billiger
      // als der Standard von 100 Millisekunden.
      interval: 200,
      binaryInterval: 1000,
    },
  },
  resolve: {
    alias: {
      // import.meta.dirname statt __dirname: der Config-Lader von Vite
      // meldet __dirname sonst als kuenftig nicht mehr unterstuetzt.
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    // Die Tokenschicht wird ueber tokens.test.ts gegen die Quelldatei
    // geprueft, nicht ueber gerendertes CSS. Tailwind im Testlauf zu
    // uebersetzen kostet Zeit und belegt nichts zusaetzlich.
    css: false,
  },
})
