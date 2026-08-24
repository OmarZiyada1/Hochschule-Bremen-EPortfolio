import { z } from "zod"

/**
 * Serverseitige Obergrenze des Kommentartexts (§6.1). Die Begruendung wird
 * zu einem {@code CHANGE_REQUEST} und unterliegt deshalb derselben Grenze
 * wie jeder Kommentar.
 */
export const REVISION_REASON_MAX = 5000

/**
 * Eingaben von „Zur Ueberarbeitung" (Frontend-Regel 12, Skill
 * frontend-modul Abschnitt 3b).
 *
 * <p><strong>Die Begruendung ist Pflicht</strong>, und das ist keine
 * Formalie: sie wird serverseitig zu einem {@code CHANGE_REQUEST} mit Stand
 * {@code OPEN} (§4.1) und ist damit der Arbeitsauftrag, den die Autor:in im
 * Editor abarbeitet. Ohne sie bekaeme sie ein Projekt zurueck und wuesste
 * nicht, was zu tun ist.
 *
 * <p>Leerraum ist kein Text: ohne {@code trim} liefe ein Feld mit drei
 * Leerzeichen hier durch und scheiterte erst am Server. Fehlertexte sind
 * i18n-Schluessel, keine Literale.
 */
export const revisionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, { message: "validation.revision.reasonRequired" })
    .max(REVISION_REASON_MAX, { message: "validation.revision.reasonTooLong" }),
})

export type RevisionFormValues = z.infer<typeof revisionSchema>
