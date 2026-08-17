import { z } from "zod"

/**
 * Eingabepruefung der Code-Eingabe (KAN-33): genau sechs Ziffern, wie der
 * Server sie erzeugt (§3.16). Gilt fuer beide Bestaetigungsseiten und fuer
 * das Zuruecksetzen. Ob der Code stimmt, entscheidet allein der Server
 * (400 VERIFICATION_CODE_INVALID).
 */
export const verificationCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "validation.code.invalid")

export const verifyCodeFormSchema = z.object({
  code: verificationCodeSchema,
})

export type VerifyCodeFormValues = z.infer<typeof verifyCodeFormSchema>
