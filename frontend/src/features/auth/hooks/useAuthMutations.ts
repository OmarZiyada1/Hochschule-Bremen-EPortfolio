import { useMutation, useQueryClient } from "@tanstack/react-query"

import { authQueries } from "@/api/queries/auth"
import {
  changePassword,
  register,
  requestPasswordReset,
  resendVerificationCode,
  resetPassword,
  verifyCode,
} from "@/api/queries/auth"

/**
 * Ein Hook je Serveroperation (Skill frontend-modul, Abschnitt 2); die
 * Mutationsfunktionen kommen aus der Fabrik api/queries/auth.ts. Der
 * Sitzungszustand laeuft ueber den Auth-Store, nicht ueber den Query-Cache.
 *
 * <p><strong>Eine Ausnahme: {@link useVerifyCode}</strong> (KAN-83). Der
 * Kopf dieser Datei behauptete, es gebe nichts zu invalidieren; das war
 * falsch, und es kostete den E-Mail-Wechsel. Die Profilseite liest ihre
 * Person aus {@code GET /auth/me} ueber React Query und faellt nur
 * ersatzweise auf den Auth-Store zurueck. Nach dem Einloesen des Codes
 * blieb dieser Cache-Eintrag stehen: das Formular hielt die alte Adresse
 * weiter fuer die aktuelle, verlangte deshalb erneut das Passwort und liess
 * sich nicht mehr speichern.
 */

export function useRegister() {
  return useMutation({ mutationFn: register })
}

/**
 * {@code POST /auth/verify} und danach ein frisches {@code GET /auth/me}.
 *
 * <p><strong>Die Invalidierung wird zurueckgegeben</strong>, nicht nur
 * angestossen: React Query wartet ein aus {@code onSuccess}
 * zurueckgegebenes Promise ab, bevor {@code mutateAsync} aufloest. Damit
 * ist der Nachlauf fertig, bevor die aufrufende Stelle weiterarbeitet, und
 * es gibt keinen Zwischenzustand, in dem das Formular die neue Adresse
 * schon eingetragen hat, waehrend die Regel noch die alte fuer die aktuelle
 * haelt.
 *
 * <p>Bewusst nicht auf den Wechselfall eingeengt: {@code POST /auth/verify}
 * aendert auch bei der Registrierung den Kontostand (emailVerified,
 * hsbEmailVerified, status) und macht einen zwischengespeicherten Stand in
 * jedem Fall ungueltig. Dort gibt es keine Sitzung, die Query haengt nicht
 * ein, und die Invalidierung kostet nichts. Ein zweiter Hook nur fuer den
 * Wechsel waere doppelte Buchfuehrung.
 */
export function useVerifyCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: verifyCode,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: authQueries.me().queryKey,
      }),
  })
}

export function useResendVerificationCode() {
  return useMutation({ mutationFn: resendVerificationCode })
}

export function useChangePassword() {
  return useMutation({ mutationFn: changePassword })
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: requestPasswordReset })
}

export function useResetPassword() {
  return useMutation({ mutationFn: resetPassword })
}
