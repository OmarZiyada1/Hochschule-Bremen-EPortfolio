import { useMutation } from "@tanstack/react-query"

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
 * Mutationsfunktionen kommen aus der Fabrik api/queries/auth.ts. Es gibt
 * nichts zu invalidieren: keine der Operationen beruehrt einen Query-Cache,
 * der Sitzungszustand laeuft ueber den Auth-Store.
 */

export function useRegister() {
  return useMutation({ mutationFn: register })
}

export function useVerifyCode() {
  return useMutation({ mutationFn: verifyCode })
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
