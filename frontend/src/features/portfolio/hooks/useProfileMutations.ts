import { useMutation, useQueryClient } from "@tanstack/react-query"

import { updateOwnProfile } from "@/api/queries/auth"
import { uploadAvatar } from "@/api/queries/files"
import { portfolioQueries, updateOwnPortfolio } from "@/api/queries/portfolio"

/**
 * Die schreibenden Vorgaenge der Profilseite (KAN-34). Ein Hook je
 * Serveroperation; die Funktionen kommen aus den Fabriken unter
 * api/queries.
 *
 * <p><strong>Zwei Endpoints, ein Formular.</strong> biography und Avatar
 * gehoeren zum Portfolio und laufen ueber PUT /api/portfolio/me, Vorname,
 * Nachname und der E-Mail-Wunsch zum User und laufen ueber
 * PUT /api/auth/me (§6.1). Die Seite setzt beide nacheinander ab und
 * benennt bei Teilerfolg, was gespeichert wurde und was nicht.
 */

/**
 * PUT /api/portfolio/me. Invalidiert wird ueber den Key der Fabrik, nie
 * ueber ein nachgebautes Literal.
 */
export function useUpdateOwnPortfolio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateOwnPortfolio,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: portfolioQueries.me().queryKey,
      })
    },
  })
}

/**
 * PUT /api/auth/me. Der Sitzungszustand wird nicht hier nachgezogen: die
 * Seite ruft dafuer refreshUser aus dem Auth-Kontext, der als einzige
 * Stelle den Store schreibt (KAN-30).
 */
export function useUpdateOwnProfile() {
  return useMutation({ mutationFn: updateOwnProfile })
}

/**
 * POST /api/files ohne projectId (§3.15). Der Upload macht das Bild noch
 * nicht zum Profilbild: gespeichert wird die zurueckgegebene Referenz erst
 * mit "Aenderungen speichern" ueber PUT /api/portfolio/me (Entscheidung aus
 * der Klaerungsrunde zu KAN-34).
 */
export function useUploadAvatar() {
  return useMutation({ mutationFn: uploadAvatar })
}
