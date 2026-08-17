import { z } from "zod"

/**
 * Eingabepruefung der Seite "Passwort vergessen" (KAN-33): nur die private
 * E-Mail-Adresse. Ob es das Konto gibt, verraet der Server bewusst nicht
 * (§6.1, immer 204); die Seite zeigt in jedem Fall dieselbe Bestaetigung.
 */
export const forgotPasswordFormSchema = z.object({
  email: z
    .string()
    .min(1, "validation.email.required")
    .pipe(z.email("validation.email.invalid")),
})

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>
