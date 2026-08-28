import { useMutation } from "@tanstack/react-query"

import { submitSupportRequest } from "@/api/queries/support"
import type { SupportRequestCreateRequest } from "@/api/types"

/**
 * Der Hook des oeffentlichen Kontaktformulars (§6.1, KAN-85). Er kennt weder
 * Pfad noch {@code api.*}: beides steht in {@code api/queries/support.ts}
 * (Skill frontend-modul, Abschnitt 2).
 *
 * <p><strong>Kein Invalidieren nach dem Erfolg.</strong> Die absendende Person
 * hat auf ihre Anfrage keinen lesenden Zugriff (§5), es gibt also keine Query,
 * die veraltet waere. Die Liste der Administration laeuft in einer anderen
 * Sitzung und wird dort beim naechsten Laden ohnehin frisch geholt.
 *
 * <p><strong>Kein automatischer zweiter Versuch.</strong> Ein wiederholter
 * Aufruf legte eine zweite Zeile im Eingangsbuch an, und bei einem 429 waere er
 * genau das, was die Bremse verhindern soll (§6.5). Der Standard von TanStack
 * Query wiederholt Mutationen ohnehin nicht; hier steht es, damit es beim
 * naechsten Anfassen nicht versehentlich eingeschaltet wird.
 */
export function useCreateSupportRequest() {
  return useMutation({
    mutationFn: (request: SupportRequestCreateRequest) =>
      submitSupportRequest(request),
    retry: false,
  })
}
