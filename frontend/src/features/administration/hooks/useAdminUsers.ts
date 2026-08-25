import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  adminQueries,
  adminUserQueries,
  createUser,
  deactivateUser,
  resetUserPassword,
  updateUser,
  type AdminUserListParams,
} from "@/api/queries/admin"
import type {
  AdminUserCreateRequest,
  AdminUserUpdateRequest,
} from "@/api/types"

/**
 * Die Query- und Mutation-Hooks der Nutzerverwaltung (§6.1, KAN-39). Sie
 * kennen weder Pfade noch {@code api.*}: beides steht in den Fabriken unter
 * {@code src/api/queries/} (Skill frontend-modul, Abschnitt 2).
 *
 * <p><strong>Jede Aenderung trifft zwei Ansichten.</strong> Neben der Liste
 * verschiebt sie die Kennzahlen der Startansicht: {@code usersTotal},
 * {@code usersByRole} und {@code usersByStatus} zaehlen genau die Konten, die
 * hier angelegt, umgestuft und deaktiviert werden (§6.1). Invalidiert wird
 * deshalb immer beides.
 */

/**
 * Der gemeinsame Praefix aller Kontoabfragen, aus der Fabrik gebildet statt
 * als Literal danebengeschrieben (Skill frontend-modul, Abschnitt 2). Er
 * trifft die Liste in jeder Filterkombination <em>und</em> jedes einzeln
 * geladene Konto, denn deren Keys beginnen mit denselben zwei Gliedern.
 */
function adminUserKey() {
  return adminUserQueries.list().queryKey.slice(0, 2)
}

/** Die paginierte Kontoliste mit Rolle, Status und Suchbegriff (§6.6). */
export function useAdminUserList(params: AdminUserListParams) {
  return useQuery(adminUserQueries.list(params))
}

/**
 * Ein einzelnes Konto fuer die Detailansicht (§6.1).
 *
 * @param userId ID des Kontos, oder {@code null}, solange kein Dialog offen
 *   ist. Dann laeuft keine Abfrage: ein Dialog, der nicht dasteht, fragt
 *   nichts ab.
 */
export function useAdminUserDetail(userId: string | null) {
  return useQuery({
    ...adminUserQueries.detail(userId ?? ""),
    enabled: userId !== null,
  })
}

/** Konto anlegen, POST /api/admin/users (201). */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: AdminUserCreateRequest) => createUser(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUserKey() })
      void queryClient.invalidateQueries({
        queryKey: adminQueries.dashboard().queryKey,
      })
    },
  })
}

/**
 * Rolle, Status oder Name aendern, PATCH /api/admin/users/{id}.
 *
 * <p>Am eigenen Konto weist der Server {@code role} und {@code status} mit
 * 400 VALIDATION_FAILED ab (Contract v26). Die Oberflaeche blendet beide
 * Eintraege in der eigenen Zeile aus und behandelt den 400 trotzdem: die
 * Regel gilt serverseitig und nicht in der Darstellung.
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: {
      userId: string
      request: AdminUserUpdateRequest
    }) => updateUser(variables.userId, variables.request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUserKey() })
      void queryClient.invalidateQueries({
        queryKey: adminQueries.dashboard().queryKey,
      })
    },
  })
}

/**
 * Konto deaktivieren, DELETE /api/admin/users/{id} (204).
 *
 * <p><strong>Es loescht nicht.</strong> Der Server setzt {@code status =
 * DEACTIVATED}; die Zeile bleibt stehen und die Beitraege der Person bleiben
 * erhalten (§6.1). Die Liste wird trotzdem neu geladen, denn der Status in
 * ihr ist jetzt ein anderer.
 */
export function useDeactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => deactivateUser(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUserKey() })
      void queryClient.invalidateQueries({
        queryKey: adminQueries.dashboard().queryKey,
      })
    },
  })
}

/**
 * Neues Initialpasswort setzen, POST /api/admin/users/{id}/reset-password
 * (200 mit {@code { initialPassword }}).
 *
 * <p>Die Liste wird neu geladen, weil {@code passwordChangeRequired} danach
 * gesetzt ist und die Zeile das anzeigt (§6.7). Das erzeugte Passwort selbst
 * bleibt im Dialog und wird nirgends zwischengespeichert: es steht in genau
 * dieser einen Antwort.
 */
export function useResetUserPassword() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => resetUserPassword(userId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminUserKey() })
    },
  })
}
