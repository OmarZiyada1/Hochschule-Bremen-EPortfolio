import { z } from "zod"

/**
 * Eingabepruefung des Login-Formulars (Frontend-Regel 12): Pflichtfelder und
 * E-Mail-Format, mehr nicht. Die Passwortregel aus Contract 3.1.1 (12 bis 72
 * Zeichen) gilt beim Setzen eines Passworts und fehlt hier bewusst: ein
 * Bestandskonto koennte sonst sein aelteres, gueltiges Passwort nicht mehr
 * eingeben. Ob die Kombination stimmt, entscheidet allein der Server
 * (401 LOGIN_FAILED).
 *
 * Fehlertexte sind i18n-Schluessel, keine Literale; uebersetzt wird erst bei
 * der Anzeige (Skill frontend-modul, Abschnitt 3b).
 */
export const loginFormSchema = z.object({
  email: z
    .string()
    .min(1, "validation.email.required")
    .pipe(z.email("validation.email.invalid")),
  password: z.string().min(1, "validation.password.required"),
})

export type LoginFormValues = z.infer<typeof loginFormSchema>
