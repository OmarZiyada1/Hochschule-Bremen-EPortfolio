import { describe, expect, it } from "vitest"

import {
  GENERATED_PASSWORD_LENGTH,
  generateInitialPassword,
} from "@/features/administration/initialPassword"

/**
 * Die Erzeugung des Initialpassworts (§3.1.1, Contract v27, KAN-39). Reine
 * Funktion, also ohne Rendern geprueft.
 */
describe("generateInitialPassword", () => {
  it("erfuellt die Passwortregel aus §3.1.1", () => {
    const password = generateInitialPassword()

    expect(password).toHaveLength(GENERATED_PASSWORD_LENGTH)
    expect(password.length).toBeGreaterThanOrEqual(12)
    expect(password.length).toBeLessThanOrEqual(72)
  })

  it("meidet die Zeichen, die sich beim Abschreiben verwechseln lassen", () => {
    /* Das Passwort wird muendlich oder auf Papier weitergegeben; I, l, 1, O
       und 0 kosten dabei genau den Weg, den die Kopierfunktion spart. */
    const sample = Array.from({ length: 40 }, () =>
      generateInitialPassword()
    ).join("")

    expect(sample).not.toMatch(/[Il1O0]/)
    expect(sample).toMatch(/^[A-Za-z2-9]+$/)
  })

  it("liefert bei jedem Aufruf ein anderes Passwort", () => {
    const passwords = new Set(
      Array.from({ length: 20 }, () => generateInitialPassword())
    )

    expect(passwords.size).toBe(20)
  })

  it("nimmt eine andere Laenge entgegen", () => {
    expect(generateInitialPassword(24)).toHaveLength(24)
  })
})
