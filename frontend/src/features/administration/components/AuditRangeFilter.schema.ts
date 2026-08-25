import { z } from "zod"

import { isIsoDate } from "@/features/administration/adminTop10Filters"

/**
 * Das Formular des Zeitraumfilters im Top-10-Protokoll (§6.1, §6.6; KAN-40).
 *
 * <p><strong>Beide Felder sind freiwillig, ihre Reihenfolge ist es
 * nicht.</strong> Ein fehlendes {@code from} heisst „von Anfang an", ein
 * fehlendes {@code to} „bis heute". Sind beide gesetzt, muss {@code from}
 * vor oder auf {@code to} liegen: der Server beantwortet den umgekehrten
 * Fall mit 400 {@code VALIDATION_FAILED}, und das ist ein Eingabefehler und
 * kein leeres Ergebnis. Genau deshalb faengt ihn das Formular ab, statt eine
 * Anfrage zu schicken, deren Antwort niemandem hilft.
 *
 * <p>Verglichen wird als Zeichenkette, und das geht auf: {@code JJJJ-MM-TT}
 * sortiert lexikografisch wie chronologisch. Ein Umweg ueber {@code Date}
 * brauchte hier eine Zeitzone, die an dieser Stelle nichts entscheidet; sie
 * kommt erst beim Bilden der Tagesgrenzen ins Spiel
 * ({@code auditQueryOf}).
 *
 * <p><strong>Geprueft wird die Eingabe, nicht die Antwort</strong>
 * (Frontend-Regel 12). Fehlertexte sind i18n-Schluessel und keine Literale.
 */
export const auditRangeSchema = z
  .object({
    /** Leere Zeichenkette heisst „nicht gesetzt", wie im Eingabefeld. */
    from: z.string(),
    to: z.string(),
  })
  .superRefine((values, context) => {
    for (const field of ["from", "to"] as const) {
      const value = values[field]
      if (value !== "" && !isIsoDate(value)) {
        context.addIssue({
          code: "custom",
          path: [field],
          message: "validation.top10.dateInvalid",
        })
      }
    }

    if (
      values.from !== "" &&
      values.to !== "" &&
      isIsoDate(values.from) &&
      isIsoDate(values.to) &&
      values.from > values.to
    ) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "validation.top10.rangeReversed",
      })
    }
  })

export type AuditRangeFormValues = z.infer<typeof auditRangeSchema>
