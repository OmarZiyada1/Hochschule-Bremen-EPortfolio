import { z } from "zod"

import { newPasswordSchema, withPasswordConfirmation } from "@/features/auth/password.schema"

/**
 * Eingabepruefung der Angaben-Seite (KAN-33, Frontend-Regel 12):
 * Pflichtfelder, E-Mail-Format beider Adressen, Passwortregel aus §3.1.1
 * und die Uebereinstimmung mit der Bestaetigung. Die Domain-Regel der
 * hsbEmail prueft bewusst nur der Server (§3.1.1): die zulaessigen Listen
 * stehen in seiner Konfiguration, ein clientseitiger Nachbau wuerde bei der
 * naechsten Aenderung abweichen. Sein 400 erscheint am Feld.
 */
export const registerDetailsFormSchema = withPasswordConfirmation(
  z.object({
    firstName: z.string().trim().min(1, "validation.firstName.required"),
    lastName: z.string().trim().min(1, "validation.lastName.required"),
    hsbEmail: z
      .string()
      .min(1, "validation.hsbEmail.required")
      .pipe(z.email("validation.email.invalid")),
    email: z
      .string()
      .min(1, "validation.email.required")
      .pipe(z.email("validation.email.invalid")),
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, "validation.passwordConfirm.required"),
  }),
  "password",
  "confirmPassword"
)

export type RegisterDetailsFormValues = z.infer<typeof registerDetailsFormSchema>
