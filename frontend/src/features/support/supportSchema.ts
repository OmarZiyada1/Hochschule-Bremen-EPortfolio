import { z } from "zod"

/**
 * Die Grenzen aus §3.20, an einer Stelle. Sie stehen als Konstanten da, weil
 * der Zeichenzaehler unter der Beschreibung dieselbe Zahl braucht: zwei
 * Abschriften liefen beim naechsten Nachtrag auseinander.
 */
export const SUPPORT_MESSAGE_MAX = 2000

/**
 * Eingabepruefung des oeffentlichen Kontaktformulars (§3.20, KAN-85,
 * Frontend-Regel 12).
 *
 * <p>Genau die fuenf sichtbaren Felder, die als Koerper an
 * {@code POST /api/support} gehen. Das versteckte {@code website} steht
 * bewusst <strong>nicht</strong> darin: es wird nie geprueft, weder hier noch
 * am Server, sondern allein ausgewertet. Eine Regel dafuer waere die erste
 * Stelle, an der ein Programm merkt, dass das Feld etwas bedeutet (§6.1).
 *
 * <p><strong>Das Schema prueft Eingaben, nie Serverantworten.</strong>
 * Verbindlich bleibt der Server; sein 400 {@code VALIDATION_FAILED} erscheint
 * ueber {@code applyValidationErrors} am betroffenen Feld. Die Grenzen sind
 * dieselben wie dort, damit der haeufige Fall ohne Netzweg auffaellt, und
 * nicht, um den Server zu ersetzen.
 *
 * <p>Die Meldungen sind i18n-Schluessel und keine Texte (Frontend-Regel 7);
 * uebersetzt wird erst in der Anzeige.
 */
export const supportFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "validation.support.name.required")
    .min(2, "validation.support.name.tooShort")
    .max(120, "validation.support.name.tooLong"),
  email: z
    .string()
    .trim()
    .min(1, "validation.support.email.required")
    .max(255, "validation.support.email.tooLong")
    .pipe(z.email("validation.email.invalid")),
  /*
   * Die fuenf Werte aus §2.14 laufen unveraendert durch den Code und werden
   * nur fuer die Anzeige uebersetzt (Frontend-Regel 6). Als Enum und nicht
   * als freier String: ein Wert daneben ergaebe am Server 400, und das
   * Auswahlfeld kann keinen anderen liefern.
   */
  category: z.enum(
    [
      "TECHNICAL_ISSUE",
      "ACCOUNT_ACCESS",
      "PROJECT_SUBMISSION",
      "ABUSE_REPORT",
      "OTHER",
    ],
    "validation.support.category.required"
  ),
  subject: z
    .string()
    .trim()
    .min(1, "validation.support.subject.required")
    .min(3, "validation.support.subject.tooShort")
    .max(160, "validation.support.subject.tooLong"),
  message: z
    .string()
    .trim()
    .min(1, "validation.support.message.required")
    .min(10, "validation.support.message.tooShort")
    .max(SUPPORT_MESSAGE_MAX, "validation.support.message.tooLong"),
})

export type SupportFormValues = z.infer<typeof supportFormSchema>

/**
 * Die Feldnamen, die der Server in einem 400 {@code VALIDATION_FAILED} nennen
 * kann (§6.2, Format {@code feld: Text}). Ohne diese Liste deutete
 * {@code applyValidationErrors} jeden Doppelpunkt im Meldungstext als
 * Feldnamen.
 *
 * <p>{@code website} steht auch hier nicht: der Server beanstandet es nie.
 */
export const SUPPORT_SERVER_FIELDS = [
  "name",
  "email",
  "category",
  "subject",
  "message",
] as const
