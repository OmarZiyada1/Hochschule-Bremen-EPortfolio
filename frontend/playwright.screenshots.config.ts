import { defineConfig, devices } from "@playwright/test"

/**
 * Der Screenshot-Lauf fuer die Hilfeseite (KAN-93).
 *
 * <p><strong>Getrennt von `pnpm e2e`.</strong> Der Barrierefreiheitslauf
 * misst und darf rot werden; dieser Lauf erzeugt Artefakte, die
 * anschliessend im Repository liegen. Zwei Laeufe mit verschiedenen Zwecken
 * in einer Konfiguration hiessen: jeder Barrierefreiheitsdurchgang schriebe
 * nebenbei zwei Dutzend Bilder neu, und jede Bildaufnahme braeuchte einen
 * gruenen axe-Lauf. Deshalb eine eigene Datei, ein eigenes Skript
 * (`pnpm screenshots`) und ein `testMatch`, das genau eine Datei nimmt.
 * Die Gegenrichtung steht in `playwright.config.ts` als `testIgnore`.
 *
 * <p><strong>Gegen den laufenden Entwicklungsstand, nicht gegen dist/.</strong>
 * Anders als der Barrierefreiheitslauf gibt es hier keinen `webServer`: die
 * Bilder entstehen gegen den Server, der ohnehin laeuft, also den
 * Dev-Compose-Stack auf Port 5173 oder ein `pnpm dev` auf demselben Port.
 * Zwei Gruende. Erstens braucht der Lauf die Sprachumstellung ueber
 * `window.__i18n`, und die gibt es nur im Entwicklungs-Build
 * (`src/i18n/index.ts`). Zweitens waere ein `pnpm build` vor jeder
 * Bildaufnahme reine Wartezeit; gezeigt wird dieselbe Oberflaeche.
 * Die Adresse laesst sich ueber `SHOT_BASE_URL` umstellen.
 *
 * <p><strong>Voraussetzungen.</strong> Backend im Profil `dev` mit den
 * Dev-Testnutzern (`DevTestUserSeeder`) und den Demodaten aus
 * `var/demodaten/`. Ohne sie bricht `discoverFixtures` frueh und mit einer
 * Meldung ab, die sagt, was fehlt.
 *
 * <p><strong>Ein Arbeiter.</strong> Die Faelle teilen sich eine Datenbank,
 * und der Editorfall tippt in einen Entwurf. Zwei Arbeiter zoegen einander
 * die Bearbeitungssperre aus §6.9 weg.
 */
export default defineConfig({
  testDir: "./e2e",
  /* Genau die eine Datei, die Bilder erzeugt. */
  testMatch: /screenshots\.spec\.ts$/,
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.SHOT_BASE_URL ?? "http://localhost:5173",
    ...devices["Desktop Chrome"],
    /*
     * Schmaler als die 1440 des Barrierefreiheitslaufs. Das Bild steht
     * spaeter in einer Textspalte von max-w-3xl; alles darueber waere
     * Dateigroesse ohne sichtbaren Gewinn, und die Oberflaeche bleibt in
     * dieser Breite die volle Desktop-Anordnung.
     */
    viewport: { width: 1280, height: 800 },
    /* Doppelte Punktdichte, damit das Bild auf einem HiDPI-Schirm nicht
       weich wird. Vervierfacht die Bytes, deshalb die schmalere Breite. */
    deviceScaleFactor: 2,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
})
