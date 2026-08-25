import { z } from "zod"

import { REVISION_REASON_MAX } from "@/features/reviews/components/RevisionDialog.schema"

/**
 * Das Formular des Statuswechsels (§6.1, KAN-38), einmal fuer die
 * Mehrfachauswahl und einmal fuer die einzelne Zeile.
 *
 * <p><strong>Die Begruendung haengt an der Aktion.</strong> {@code reason} ist
 * Pflicht, sobald {@code action} den Wert {@code request-revision} traegt, und
 * bei {@code publish} unzulaessig. Der Grund liegt beim Einzel-Endpoint: der
 * Text wird je ausgewaehltem Projekt ein eigener CHANGE_REQUEST-Kommentar
 * (§2.3), und ohne ihn bliebe die Autor:in ohne Arbeitsauftrag. Ein Verstoss
 * ergibt serverseitig 400 {@code VALIDATION_FAILED} fuer die <em>ganze</em>
 * Anfrage und keine Ergebnisliste.
 *
 * <p><strong>Geprueft wird die Eingabe, nicht die Antwort</strong>
 * (Frontend-Regel 12). Verbindlich bleibt der Server; dieses Schema macht den
 * Fehler nur vor dem Absenden sichtbar und verhindert, dass eine
 * Sammelanfrage fuer zwanzig Projekte an einem leeren Textfeld scheitert.
 *
 * <p>Der Ausschluss bei {@code publish} steht bewusst als eigene Regel und
 * wird nicht still weggeworfen: eine abgeschickte, aber verworfene
 * Begruendung waere die schlechteste der drei Moeglichkeiten (§6.1, KAN-46).
 * Im Formular kann er nicht ausgeloest werden, weil das Feld dort gar nicht
 * erscheint; er sichert die Zusage trotzdem an derselben Stelle ab, an der
 * sie steht.
 */
export const bulkStatusSchema = z
  .object({
    action: z.enum(["publish", "request-revision"]),
    reason: z.string(),
  })
  .superRefine((values, context) => {
    const trimmed = values.reason.trim()

    if (values.action === "request-revision" && trimmed === "") {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "administration.projects.statusDialog.reasonRequired",
      })
    }
    if (values.action === "publish" && trimmed !== "") {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "administration.projects.statusDialog.reasonNotAllowed",
      })
    }
    /* Dieselbe Obergrenze wie beim Einzel-Endpoint, und zwar aus dessen
       Schema statt als zweite Zahl daneben: der Text wird derselbe
       CHANGE_REQUEST-Kommentar und unterliegt derselben Grenze (§6.1). */
    if (trimmed.length > REVISION_REASON_MAX) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "validation.revision.reasonTooLong",
      })
    }
  })

export type BulkStatusFormValues = z.infer<typeof bulkStatusSchema>
