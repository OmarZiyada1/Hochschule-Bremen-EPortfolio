import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// Ziel des Entwicklungs-Proxys. Auf dem Host das lokale Backend, im
// Compose-Netz der Dienstname (gesetzt in docker-compose.override.yml).
const proxyTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:8080"

// Dieselben Pfade fuer Entwicklungs- und Vorschauserver. Der Vorschauserver
// liefert den gebauten Stand aus und ist damit das Ziel des e2e-Laufs
// (KAN-42, Umfang 8); ohne diesen Proxy liefe dort jeder Request gegen
// /api ins Leere, weil die gebaute Anwendung bewusst keine Basis-URL
// mitbringt (api/client.ts).
const apiProxy = {
  "/api": { target: proxyTarget, changeOrigin: true },
  "/v3/api-docs": { target: proxyTarget, changeOrigin: true },
}

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
    proxy: apiProxy,
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
  // Der Vorschauserver liefert dist/ aus. Er ist der Auslieferungsstand und
  // damit das, wogegen der axe-Lauf prueft: im Entwicklungsserver stehen
  // zusaetzlich /dev/tokens und /dev/components, und die gehoeren nicht zur
  // geprueften Anwendung (KAN-42, Umfang 1).
  preview: {
    port: 4173,
    strictPort: true,
    proxy: {
      /*
       * Wie im Entwicklungsserver, aber ohne den Origin-Kopf.
       *
       * Der Browser spricht mit dem Vorschauserver auf demselben Ursprung,
       * fuer ihn gibt es hier gar kein CORS. Der Proxy reicht den
       * Origin-Kopf trotzdem weiter, und das Backend prueft ihn gegen
       * CORS_ALLOWED_ORIGINS: dort steht der Entwicklungsserver (5173), nicht
       * die Vorschau (4173). Lesende Aufrufe kamen durch, schreibende
       * beantwortete Spring Security mit 403 "Invalid CORS request". Auf
       * /projects/new hiess das: die Seite zeigte eine Fehlermeldung, und der
       * Barrierefreiheitslauf prueft die Fehlermeldung statt der Seite.
       *
       * Weitergereicht wird deshalb ohne Origin. Das ist keine Umgehung,
       * sondern die richtige Beschreibung des Vorgangs: der Aufruf des
       * Proxys ist ein Server-zu-Server-Aufruf und kein Cross-Origin-Aufruf
       * eines Browsers. Der Entwicklungsserver bleibt unveraendert, damit
       * dort weiterhin genau die Liste gilt, die auch im Betrieb gilt.
       */
      ...Object.fromEntries(
        Object.entries(apiProxy).map(([path, options]) => [
          path,
          {
            ...options,
            configure: (proxy: {
              on: (
                event: "proxyReq",
                handler: (request: {
                  removeHeader: (name: string) => void
                }) => void
              ) => void
            }) => {
              proxy.on("proxyReq", (request) => {
                request.removeHeader("origin")
              })
            },
          },
        ])
      ),
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
    /*
     * Nur, was unter src/ liegt. Ohne diese Zeile sammelt Vitest auch
     * e2e/accessibility.spec.ts ein, weil sein Standardmuster jede
     * .spec.ts-Datei des Projekts trifft; die Datei bricht dann mit
     * "Playwright Test did not expect test.describe() to be called here" ab.
     * Die Trennung ist gewollt: Vitest braucht weder Server noch Datenbank,
     * der e2e-Lauf beides (KAN-42, Umfang 8; Skript pnpm e2e).
     */
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    // Die Tokenschicht wird ueber tokens.test.ts gegen die Quelldatei
    // geprueft, nicht ueber gerendertes CSS. Tailwind im Testlauf zu
    // uebersetzen kostet Zeit und belegt nichts zusaetzlich.
    css: false,
    // Dreissig Sekunden statt der fuenf aus der Voreinstellung. Eine Seite
    // mit dem Editor braucht in jsdom mehrere Sekunden, bis sie steht, und
    // unter Last deutlich laenger: mit der Voreinstellung fielen im vollen
    // Lauf wechselnde Faelle aus, die einzeln gruen sind. Die Faelle, die
    // ihr Limit selbst setzen, behalten es; global gilt eine Grenze, die
    // eine echte Haengepartie weiterhin abbricht.
    //
    // Von zwanzig auf dreissig mit KAN-101, aus zwei Gruenden. Erstens laeuft
    // dieser Lauf jetzt auch in GitHub Actions auf zwei Kernen, wo die
    // parallelen Faelle einander deutlich staerker im Weg stehen als auf
    // einem Entwicklerrechner. Zweitens warten die lastempfindlichen Faelle
    // selbst bis zu zwanzig Sekunden; laege die globale Grenze gleichauf,
    // braeche der Fall mit "Test timed out" ab, bevor waitFor sagen kann,
    // wonach es gesucht hat und was stattdessen im DOM stand. Ein groesseres
    // Limit kostet nur dort Zeit, wo ohnehin schon etwas kaputt ist.
    testTimeout: 30000,
  },
})
