import { defineConfig, devices } from "@playwright/test"

/**
 * Der automatisierte Barrierefreiheitslauf (KAN-42, Umfang 8).
 *
 * <p><strong>Getrennt von `pnpm test`.</strong> Vitest laeuft in jsdom, ohne
 * Server und ohne Datenbank, und soll diese Bedingung auch nicht bekommen:
 * ein Unit-Test, der erst nach `docker compose up` gruen wird, ist kein
 * Unit-Test mehr. Dieser Lauf braucht dagegen beides, weil er misst, was
 * ein Browser tatsaechlich rendert. Deshalb ein eigenes Skript `pnpm e2e`
 * und ein eigener Ordner `e2e/`, den die Vitest-Konfiguration nicht sieht
 * (sie sammelt nur unter `src/`).
 *
 * <p><strong>Gegen den gebauten Stand, nicht gegen den Entwicklungsserver.</strong>
 * `pnpm build` und `pnpm preview` liefern dist/ aus. Im Entwicklungsserver
 * gaebe es zusaetzlich /dev/tokens und /dev/components (import.meta.env.DEV),
 * und die gehoeren nicht zur geprueften Anwendung.
 *
 * <p><strong>Zwei Projekte statt eines.</strong> Contract 2.5 verlangt
 * Kontrast in hell und dunkel, und ein Durchgang kann immer nur eines von
 * beidem sein. Die Farbwahl liegt im localStorage-Schluessel `theme`
 * (components/theme-provider.tsx); jedes Projekt setzt ihn vor dem ersten
 * Bild ueber ein Init-Skript, damit keine Seite zuerst hell aufblitzt und
 * axe den falschen Stand misst.
 *
 * <p><strong>Voraussetzungen.</strong> Ein laufendes Backend mit den
 * Dev-Testnutzern (DevTestUserSeeder) und den Demodaten aus
 * var/demodaten/. Das Ziel des Proxys steht in VITE_PROXY_TARGET
 * (vite.config.ts, Vorgabe http://localhost:8080). Fehlt das Backend,
 * scheitert der Lauf frueh und sichtbar: eine gruene Barrierefreiheits-
 * pruefung auf lauter Fehlerseiten waere schlimmer als ein roter Lauf.
 */
export default defineConfig({
  testDir: "./e2e",
  /*
   * Der Screenshot-Lauf der Hilfeseite liegt im selben Ordner, gehoert aber
   * nicht hierher (KAN-93): er erzeugt Artefakte, statt zu messen, und
   * braucht den Entwicklungsserver auf 5173 statt der Vorschau auf 4173.
   * Ohne diese Zeile liefe er bei jedem Barrierefreiheitsdurchgang mit, und
   * zwar zweimal, einmal je Farbprojekt. Seine eigene Konfiguration steht in
   * playwright.screenshots.config.ts, sein Skript heisst `pnpm screenshots`.
   */
  testIgnore: /screenshots\.spec\.ts$/,
  /*
   * Ein Arbeiter. Die Laeufe teilen sich eine Datenbank, und /projects/new
   * legt beim Aufruf ein Projekt an (das ist die Aufgabe der Seite, kein
   * Nebeneffekt des Tests). Parallel laufende Arbeiter wuerden einander die
   * Listenstaende unter den Fuessen wegziehen.
   */
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:4173",
    /*
     * Die Breite der Referenzaufloesung aus dem Figma-Template. Der
     * Schmalfall wird nicht hier gesetzt, sondern je Pruefung: die
     * 320-Pixel-Messung ist eine eigene Behauptung und kein zweiter
     * Durchgang (Umfang 5).
     */
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "hell",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: "dunkel",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "dark",
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
  webServer: {
    command: "pnpm build && pnpm preview",
    url: "http://localhost:4173/",
    /*
     * Ein bereits laufender Vorschauserver wird wiederverwendet, sonst
     * kostet jeder Lauf beim Entwickeln einen vollstaendigen Build. In CI
     * gibt es keinen, dort wird immer frisch gebaut.
     */
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
  },
})
