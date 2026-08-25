import { describe, expect, it } from "vitest"

import de from "@/i18n/de.json"
import { acceptNominationSchema } from "@/features/administration/components/AcceptNominationDialog.schema"
import { auditRangeSchema } from "@/features/administration/components/AuditRangeFilter.schema"

/**
 * Die beiden zod-Schemata der Top-10-Verwaltung (Ticket KAN-40, Test 7;
 * Frontend-Regel 12).
 *
 * <p>Geprueft wird ohne Rendern und ohne Request: genau darum geht es. Das
 * Schema faengt den Fehler vor dem Absenden ab, verbindlich bleibt der
 * Server mit 400 {@code VALIDATION_FAILED}.
 *
 * <p>Die Meldungen sind i18n-Schluessel und keine Literale; der letzte Test
 * je Block belegt, dass es die Schluessel auch gibt.
 */
describe("Top-10-Formulare", () => {
  describe("acceptNominationSchema", () => {
    it("nimmt einen Platz zwischen 1 und 10 an", () => {
      expect(acceptNominationSchema.safeParse({ position: "1" }).success).toBe(
        true
      )
      expect(acceptNominationSchema.safeParse({ position: "10" }).success).toBe(
        true
      )
    })

    it("beanstandet einen fehlenden Platz", () => {
      const result = acceptNominationSchema.safeParse({ position: "" })

      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "validation.top10.positionRequired"
      )
    })

    /* §3.11: die Liste hat zehn Plaetze, einen elften gibt es nicht. */
    it("beanstandet einen Platz ausserhalb von 1 bis 10", () => {
      for (const position of ["0", "11", "-3"]) {
        const result = acceptNominationSchema.safeParse({ position })

        expect(result.success, position).toBe(false)
        expect(result.error?.issues[0]?.message).toBe(
          "validation.top10.positionOutOfRange"
        )
      }
    })

    it("beanstandet eine Zahl mit Nachkommastellen und eine Nichtzahl", () => {
      expect(acceptNominationSchema.safeParse({ position: "2.5" }).success).toBe(
        false
      )
      expect(acceptNominationSchema.safeParse({ position: "drei" }).success).toBe(
        false
      )
    })

    it("fuehrt jeden Fehlertext als Schluessel in de.json", () => {
      expect(de.validation.top10).toHaveProperty("positionRequired")
      expect(de.validation.top10).toHaveProperty("positionOutOfRange")
    })
  })

  describe("auditRangeSchema", () => {
    it("nimmt einen leeren Zeitraum an: von Anfang an bis heute", () => {
      expect(auditRangeSchema.safeParse({ from: "", to: "" }).success).toBe(true)
    })

    it("nimmt eine Grenze allein an", () => {
      expect(
        auditRangeSchema.safeParse({ from: "2026-08-01", to: "" }).success
      ).toBe(true)
      expect(
        auditRangeSchema.safeParse({ from: "", to: "2026-08-25" }).success
      ).toBe(true)
    })

    it("nimmt denselben Tag als Anfang und Ende an", () => {
      expect(
        auditRangeSchema.safeParse({ from: "2026-08-25", to: "2026-08-25" })
          .success
      ).toBe(true)
    })

    /*
     * §6.1: „from" nach „to" ergibt serverseitig 400 VALIDATION_FAILED und
     * ist als Eingabefehler zu behandeln, nicht als leeres Ergebnis. Genau
     * deshalb faengt das Formular den Fall vorab ab.
     */
    it("beanstandet ein Ende vor dem Anfang, und zwar am Endfeld", () => {
      const result = auditRangeSchema.safeParse({
        from: "2026-08-25",
        to: "2026-08-01",
      })

      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.path).toEqual(["to"])
      expect(result.error?.issues[0]?.message).toBe(
        "validation.top10.rangeReversed"
      )
    })

    it("beanstandet ein Datum, das es nicht gibt", () => {
      const result = auditRangeSchema.safeParse({ from: "2026-02-31", to: "" })

      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(
        "validation.top10.dateInvalid"
      )
    })

    it("fuehrt jeden Fehlertext als Schluessel in de.json", () => {
      expect(de.validation.top10).toHaveProperty("dateInvalid")
      expect(de.validation.top10).toHaveProperty("rangeReversed")
    })
  })
})
