import { z } from "zod"

/**
 * Eingabepruefung des Profilformulars (KAN-34, Frontend-Regel 12).
 *
 * <p>Die Laengen kommen aus dem Contract: biography hoechstens 5000 Zeichen
 * (§6.1, PortfolioUpdateRequest). Fehlertexte sind i18n-Schluessel,
 * uebersetzt wird erst bei der Anzeige.
 *
 * <p><strong>Die Bedingung fuer currentPassword steht im Schema</strong>,
 * nicht im Komponentencode: Pflicht ist das Feld genau dann, wenn die
 * eingegebene Adresse von der aktuellen abweicht (§6.1, KAN-60). Deshalb
 * ist das Schema eine Fabrik, die die aktuelle Adresse entgegennimmt. Eine
 * Pruefung neben dem Schema driftet von ihm weg und wird nie mitgetestet.
 *
 * <p>zod prueft ausschliesslich Eingaben. Verbindlich bleibt der Server:
 * sein 401 LOGIN_FAILED bei falschem Passwort und sein 409 RESOURCE_IN_USE
 * bei vergebener Adresse erscheinen zusaetzlich am betroffenen Feld.
 */

/** Contract §6.1: PortfolioUpdateRequest.biography, hoechstens 5000 Zeichen. */
export const BIOGRAPHY_MAX_LENGTH = 5000

/**
 * Ob die eingegebene Adresse einen Wechsel bedeutet. Gross- und
 * Kleinschreibung sowie Randleerzeichen zaehlen nicht: wer nur die
 * Schreibweise aendert, soll nicht nach seinem Passwort gefragt werden.
 *
 * Dieselbe Funktion entscheidet im Schema ueber die Pflicht und in der
 * Ansicht ueber die Sichtbarkeit des Feldes; so gibt es nur eine
 * Auffassung davon, was "geaendert" heisst.
 */
export function isEmailChange(entered: string, current: string): boolean {
  return entered.trim().toLowerCase() !== current.trim().toLowerCase()
}

export function profileFormSchema(currentEmail: string) {
  return z
    .object({
      firstName: z.string().trim().min(1, "validation.firstName.required"),
      lastName: z.string().trim().min(1, "validation.lastName.required"),
      email: z
        .string()
        .min(1, "validation.email.required")
        .pipe(z.email("validation.email.invalid")),
      currentPassword: z.string(),
      biography: z
        .string()
        .max(BIOGRAPHY_MAX_LENGTH, "validation.biography.tooLong"),
      /* Referenz der Form /api/files/{id} (§3.15.1). Sie entsteht allein
         aus der Antwort des Uploads und wird nie getippt, deshalb ohne
         eigene Formatpruefung. */
      avatarUrl: z.string(),
    })
    .superRefine((values, ctx) => {
      if (
        isEmailChange(values.email, currentEmail) &&
        values.currentPassword === ""
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["currentPassword"],
          message: "validation.currentPassword.requiredForEmailChange",
        })
      }
    })
}

export type ProfileFormValues = z.infer<ReturnType<typeof profileFormSchema>>
