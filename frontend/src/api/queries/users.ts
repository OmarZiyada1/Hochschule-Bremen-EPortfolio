import { queryOptions } from "@tanstack/react-query"

import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type { Role, UserLookupResponse } from "@/api/types"

/**
 * queryOptions-Fabrik der Personensuche (§6.1, KAN-44): GET
 * /api/users/lookup liefert aktive Konten fuer ein Auswahlfeld, sortiert
 * nach Nachname und bei Gleichstand nach Vorname, ohne Paginierung.
 *
 * <p><strong>Eigene Datei, nicht bei den Stammdaten.</strong> Die vier
 * Listen in masterData.ts pflegt die Administration, sie sind PUBLIC und
 * werden einmal vollstaendig geladen. Dies hier ist eine Suche ueber
 * Konten, sie verlangt eine Anmeldung (§5, Zeile „Auswahlliste der
 * Redakteur:innen lesen") und liefert je Suchbegriff ein anderes Ergebnis.
 *
 * <p><strong>Die Antwort fuehrt keine Adressen.</strong> Genau dafuer gibt
 * es den Endpoint: AdminUserResponse traegt hsbEmail und scheidet als
 * Quelle fuer ein Auswahlfeld aus (§3.1). Der Client filtert daran nichts
 * nach, er zeigt an, was kommt (Skill frontend-api, Abschnitt 8).
 */
export const userQueries = {
  /**
   * @param params.role Nur Konten dieser Rollen. Der Parameter ist seit
   *   Contract v89 mehrwertig (KAN-87): mehrere Werte sind ODER-verknuepft
   *   und werden als wiederholtes {@code ?role=} geschickt, was der Client
   *   von sich aus tut. Die Redaktionszuweisung fragt
   *   {@code ["EDITOR", "ADMIN"]} ab, weil beide Rollen zuweisbar sind
   *   (§5, Fussnoten 3 und 5). Ohne Angabe kommen alle Rollen; das ist der
   *   Fall der Projektmitglieder, die keine Systemrolle voraussetzen (§3.13).
   * @param params.q Suchbegriff ueber Vor- und Nachname. Leer laesst ihn weg
   *   und liefert die ersten Treffer der Sortierung.
   */
  lookup: (params: { role?: readonly Role[]; q?: string } = {}) =>
    queryOptions({
      queryKey: [
        "users",
        "lookup",
        { role: params.role ?? null, q: params.q ?? "" },
      ] as const,
      queryFn: () =>
        api.get<UserLookupResponse[]>(apiPaths.users.lookup, {
          query: {
            role: params.role,
            q: params.q === "" ? undefined : params.q,
          },
        }),
    }),
}
