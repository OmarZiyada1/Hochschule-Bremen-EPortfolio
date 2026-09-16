import { defineConfig, devices } from "@playwright/test"

/**
 * Erhebungslauf der heuristischen Evaluation (Durchgang 2). Kein Testlauf:
 * er behauptet nichts, sondern nimmt Bilder und Textinventare auf. Laeuft
 * gegen den Entwicklungsstand auf 5173, weil der ohnehin steht.
 */
export default defineConfig({
  testDir: "./heuristik-lauf",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.HE_BASE_URL ?? "http://localhost:5173",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    trace: "off",
    video: "off",
  },
})
