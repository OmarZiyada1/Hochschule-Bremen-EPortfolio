import { z } from "zod"

import type { Role } from "@/api/types"
import { ADMIN_USER_ROLES } from "@/features/administration/adminUserFilters"

/**
 * Die Rolle als Formularfeld (§2.1, §3.1.1; KAN-39).
 *
 * <p>An zwei Stellen dieselbe Regel: die Kontoanlage waehlt sie frei, auch
 * {@code ADMIN}, und die Zeilenaktion „Rolle aendern" stuft ein bestehendes
 * Konto um (Tutor-Fall, §3.1.1). Zwei Abschriften liefen beim naechsten
 * Nachtrag auseinander.
 *
 * <p>Die Werteliste kommt aus {@code adminUserFilters.ts} und steht nicht ein
 * zweites Mal hier: eine vierte Rolle soll an genau einer Stelle im Frontend
 * nachgezogen werden. Ohne Auswahl ist der Wert leer und faellt in diese
 * Meldung.
 */
export const roleValueSchema = z.enum(
  [...ADMIN_USER_ROLES] as [Role, ...Role[]],
  { message: "validation.role.required" }
)
