import { z } from "zod"

import {
  newPasswordSchema,
  withPasswordConfirmation,
} from "@/features/auth/password.schema"

/**
 * Eingabepruefung der erzwungenen bzw. freiwilligen Passwortaenderung
 * (KAN-33, §6.7): aktuelles Passwort als Pflichtfeld ohne Laengenregel
 * (ein Bestandskonto koennte ein aelteres, kuerzeres Passwort fuehren),
 * neues Passwort nach §3.1.1 samt Bestaetigung. Ob das aktuelle Passwort
 * stimmt, entscheidet der Server (401 LOGIN_FAILED).
 */
export const changePasswordFormSchema = withPasswordConfirmation(
  z.object({
    currentPassword: z.string().min(1, "validation.password.required"),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().min(1, "validation.passwordConfirm.required"),
  }),
  "newPassword",
  "confirmPassword"
)

export type ChangePasswordFormValues = z.infer<typeof changePasswordFormSchema>
