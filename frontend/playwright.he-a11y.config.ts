import { defineConfig, devices } from "@playwright/test"

/**
 * Durchgang 3 der heuristischen Evaluation: derselbe Pruefsatz wie
 * `pnpm e2e`, aber gegen den laufenden Entwicklungsstand auf 5173 statt
 * gegen die Vorschau auf 4173.
 *
 * <p><strong>Warum nicht die vorhandene Konfiguration?</strong> Auf dieser
 * Maschine belegt ein lokal installierter PostgreSQL-Dienst den Port 8080
 * und kommt dem Port-Mapping des Backend-Containers zuvor. Der
 * Vorschauserver auf dem Host proxyt nach `http://localhost:8080`, landet
 * also bei Postgres und bekommt ECONNRESET; jeder datenfuehrende Fall
 * scheitert. Der Frontend-Container auf 5173 proxyt dagegen nach
 * `http://backend:8080` im Docker-Netz und erreicht das Backend.
 *
 * <p>Der Unterschied Entwicklungsserver statt gebautem Stand betrifft nur
 * die beiden Pruefflaechen /dev/tokens und /dev/components, und die stehen
 * ohnehin nicht im Pruefsatz.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: /accessibility\.spec\.ts$/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"], ["json", { outputFile: process.env.HE_A11Y_JSON ?? "he-a11y.json" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.HE_BASE_URL ?? "http://localhost:5173",
    viewport: { width: 1440, height: 900 },
    trace: "off",
    screenshot: "off",
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
})
