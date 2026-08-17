import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import type {
  ForgotPasswordRequest,
  PasswordChangeRequest,
  RegisterRequest,
  ResendVerificationRequest,
  ResetPasswordRequest,
  UserResponse,
  VerificationStatusResponse,
  VerifyRequest,
} from "@/api/types"

/**
 * Mutationsfunktionen der Ressource Auth (Skill frontend-modul, Abschnitt 2):
 * Pfad und Response-Typ je Serveroperation an genau einer Stelle, die Pfade
 * aus api/endpoints.ts. Die Feature-Hooks unter features/auth/hooks packen
 * diese Funktionen in useMutation und kennen weder Pfade noch api.*.
 *
 * Login, Logout und GET /auth/me laufen weiterhin ueber den Auth-Kontext
 * (KAN-30): sie schreiben den Sitzungszustand und gehoeren deshalb dorthin,
 * nicht in eine Fabrik, die davon nichts weiss.
 */

/**
 * POST /auth/register (§6.1): legt das Konto an und antwortet 201 in der
 * Form von GET /auth/me, also ohne passwordHash und ohne hsbEmail. Die
 * Antwort nennt die aus der Domain abgeleitete Rolle und den Status
 * REGISTRATION_PENDING.
 */
export function register(body: RegisterRequest): Promise<UserResponse> {
  return api.post<UserResponse>(apiPaths.auth.register, body)
}

/**
 * POST /auth/verify (§6.1): email ist immer die private Adresse, auch beim
 * Zweck HSB_EMAIL; der Zweck sagt nur, welche der beiden Adressen der Code
 * bestaetigt. Die Antwort traegt den Stand beider Flags und den Status;
 * erst status = ACTIVE erlaubt die Anmeldung.
 */
export function verifyCode(
  body: VerifyRequest
): Promise<VerificationStatusResponse> {
  return api.post<VerificationStatusResponse>(apiPaths.auth.verify, body)
}

/**
 * POST /auth/verify/resend (§6.1): antwortet immer 204, unabhaengig davon,
 * ob eine Mail rausging. Die Oberflaeche zeigt deshalb stets dieselbe
 * Bestaetigung.
 */
export function resendVerificationCode(
  body: ResendVerificationRequest
): Promise<void> {
  return api.post<void>(apiPaths.auth.verifyResend, body)
}

/**
 * PUT /auth/password (§6.7): prueft das aktuelle Passwort (falsch: 401
 * LOGIN_FAILED) und setzt passwordChangeRequired zurueck.
 */
export function changePassword(body: PasswordChangeRequest): Promise<void> {
  return api.put<void>(apiPaths.auth.password, body)
}

/**
 * POST /auth/forgot-password (§6.1): antwortet immer 204, auch bei
 * unbekannter Adresse oder nicht aktivem Konto (§3.16, v35).
 */
export function requestPasswordReset(
  body: ForgotPasswordRequest
): Promise<void> {
  return api.post<void>(apiPaths.auth.forgotPassword, body)
}

/**
 * POST /auth/reset-password (§6.1): setzt das Passwort mit dem per Mail
 * zugestellten Code. Jeder Fehlschlag (unbekannte Adresse, nicht aktives
 * Konto, falscher Code) ergibt dieselbe Antwort 400 VERIFICATION_CODE_INVALID.
 */
export function resetPassword(body: ResetPasswordRequest): Promise<void> {
  return api.post<void>(apiPaths.auth.resetPassword, body)
}
