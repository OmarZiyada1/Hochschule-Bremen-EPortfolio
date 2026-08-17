import { z } from "zod"

/**
 * Passwortregel aus Contract §3.1.1: mindestens 12 und hoechstens 72
 * Zeichen, keine Vorgabe zu Zeichenklassen. Sie gilt ueberall, wo ein
 * Passwort gesetzt wird (Registrierung, erzwungene Aenderung,
 * Zuruecksetzen), und steht deshalb wie im Backend an genau einer Stelle.
 * Das Login prueft sie bewusst nicht (LoginForm.schema.ts).
 *
 * Fehlertexte sind i18n-Schluessel, uebersetzt wird bei der Anzeige.
 */
export const newPasswordSchema = z
  .string()
  .min(1, "validation.password.required")
  .min(12, "validation.password.tooShort")
  .max(72, "validation.password.tooLong")

/**
 * Haengt die Uebereinstimmungspruefung von Passwort und Bestaetigung an ein
 * Objekt-Schema mit den Feldern passwordField und confirmField. Als
 * Funktion, weil die Formulare verschiedene Feldnamen fuehren (password
 * bei der Registrierung, newPassword bei Aenderung und Zuruecksetzen).
 */
export function withPasswordConfirmation<
  Shape extends z.ZodRawShape,
  Schema extends z.ZodObject<Shape>,
>(schema: Schema, passwordField: keyof z.infer<Schema>, confirmField: keyof z.infer<Schema>) {
  return schema.refine(
    (values) => values[passwordField] === values[confirmField],
    {
      path: [confirmField as string],
      message: "validation.passwordConfirm.mismatch",
    }
  )
}
