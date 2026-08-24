import { z } from "zod"

import type { CommentType } from "@/api/types"

/**
 * Serverseitige Obergrenze aus {@code CommentCreateRequest} und
 * {@code CommentTextRequest} (§6.1). Sie steht hier, damit der Zaehler unter
 * dem Feld und die Pruefung dieselbe Zahl nennen.
 */
export const COMMENT_TEXT_MAX = 5000

/**
 * Eingaben des Kommentarformulars (Frontend-Regel 12, Skill frontend-modul
 * Abschnitt 3b).
 *
 * <p><strong>Das Schema prueft Eingaben, nie Serverantworten.</strong> Die
 * Antworttypen kommen aus der generierten {@code schema.d.ts}; ein
 * zod-Schema darueber waere ein handgeschriebener Response-Typ in
 * Verkleidung.
 *
 * <p><strong>Leerraum ist kein Text.</strong> {@code @NotBlank} weist ihn
 * serverseitig ab; ohne {@code trim} vor der Laengenpruefung liefe ein Feld
 * mit drei Leerzeichen hier durch und scheiterte erst am Server.
 *
 * <p><strong>Die erlaubten Typen kommen von aussen</strong> und stehen
 * nicht fest im Schema: welche §2.3 zulaesst, entscheidet die Rolle und der
 * Ort (§5). Ein festes {@code z.enum} ueber alle drei liesse die
 * Oberflaeche einen Typ absenden, den sie gar nicht anbietet.
 *
 * <p>Fehlertexte sind i18n-Schluessel, keine Literale: den Text setzt die
 * Anzeige, und jeder Schluessel steht in {@code de.json} und {@code en.json}.
 */
export function commentFormSchema(
  allowedTypes: readonly [CommentType, ...CommentType[]]
) {
  return z.object({
    /*
     * z.enum ueber die uebergebenen Werte statt z.string().refine: nur so
     * traegt der abgeleitete Formulartyp CommentType und nicht string, und
     * der Typecheck faengt eine Absendung mit einem Typ ab, den §2.3 nicht
     * kennt.
     */
    type: z.enum([...allowedTypes] as [CommentType, ...CommentType[]], {
      message: "validation.comment.type",
    }),
    text: z
      .string()
      .trim()
      .min(1, { message: "validation.comment.textRequired" })
      .max(COMMENT_TEXT_MAX, { message: "validation.comment.textTooLong" }),
  })
}

export type CommentFormValues = z.infer<ReturnType<typeof commentFormSchema>>
