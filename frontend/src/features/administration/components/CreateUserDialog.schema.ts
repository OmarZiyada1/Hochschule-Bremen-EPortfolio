import { z } from "zod"

import { roleValueSchema } from "@/features/administration/components/userRole.schema"
import { newPasswordSchema } from "@/features/auth/password.schema"

/**
 * Eingabepruefung des Dialogs „Konto anlegen" (KAN-39, Frontend-Regel 12).
 *
 * <p>Genau die sechs Felder, die als Koerper an {@code POST
 * /api/admin/users} gehen (§6.1). Status, Verifizierungsflags und
 * {@code passwordChangeRequired} setzt der Server; dafuer gibt es kein
 * Eingabefeld und deshalb auch keine Regel.
 *
 * <p><strong>Die Rolle ist frei waehlbar, auch ADMIN</strong> (§3.1.1,
 * Contract v26). Anders als bei der Selbstregistrierung wird sie nicht aus
 * der Domain abgeleitet: dort ist niemand ausser der sich registrierenden
 * Person beteiligt, hier entscheidet ein Admin ueber ein fremdes Konto.
 *
 * <p><strong>Die Domainregel der HSB-Adresse prueft allein der Server</strong>
 * (§3.1.1): die zulaessigen Listen stehen in seiner Konfiguration, ein
 * clientseitiger Nachbau wiche bei der naechsten Aenderung ab. Sein 400
 * VALIDATION_FAILED erscheint am Feld.
 *
 * <p>Die Passwortregel kommt aus {@code password.schema.ts} und wird nicht
 * daneben neu geschrieben: 12 bis 72 Zeichen gelten ueberall, wo ein
 * Passwort gesetzt wird (§3.1.1).
 */
export const createUserFormSchema = z.object({
  firstName: z.string().trim().min(1, "validation.firstName.required"),
  lastName: z.string().trim().min(1, "validation.lastName.required"),
  email: z
    .string()
    .min(1, "validation.email.required")
    .pipe(z.email("validation.email.invalid")),
  hsbEmail: z
    .string()
    .min(1, "validation.hsbEmail.required")
    .pipe(z.email("validation.email.invalid")),
  /*
   * Die Regel steht in userRole.schema.ts und nicht ein zweites Mal hier:
   * die Zeilenaktion „Rolle aendern" prueft dieselbe Auswahl, und zwei
   * Abschriften liefen beim naechsten Nachtrag auseinander.
   */
  role: roleValueSchema,
  password: newPasswordSchema,
})

export type CreateUserFormValues = z.infer<typeof createUserFormSchema>

/**
 * Die Feldnamen, die der Server in einem 400 VALIDATION_FAILED nennen kann
 * (§6.2, Format {@code feld: Text}). Ohne diese Liste deutete
 * {@code applyValidationErrors} jeden Doppelpunkt im Meldungstext als
 * Feldnamen.
 */
export const CREATE_USER_SERVER_FIELDS = [
  "firstName",
  "lastName",
  "email",
  "hsbEmail",
  "role",
  "password",
] as const
