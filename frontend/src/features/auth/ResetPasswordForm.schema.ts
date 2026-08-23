import { z } from "zod"

import {
  newPasswordSchema,
  withPasswordConfirmation,
} from "@/features/auth/password.schema"
import { verificationCodeSchema } from "@/features/auth/VerifyCodeForm.schema"

/**
 * Eingabepruefung der Seite "Passwort zuruecksetzen" (KAN-33): private
 * Adresse, sechsstelliger Code aus der Mail (§2.11, PASSWORD_RESET) und
 * das neue Passwort nach §3.1.1 samt Bestaetigung. Jeder fachliche
 * Fehlschlag antwortet identisch mit 400 VERIFICATION_CODE_INVALID (§6.1,
 * v35); die Seite zeigt dafuer genau eine Meldung.
 */
export const resetPasswordFormSchema = withPasswordConfirmation(
  z.object({
    email: z
      .string()
      .min(1, "validation.email.required")
      .pipe(z.email("validation.email.invalid")),
    code: verificationCodeSchema,
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "validation.passwordConfirm.required"),
  }),
  "newPassword",
  "confirmPassword"
)

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>
