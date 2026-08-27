import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import {
  clearSessionNotice,
  endSession,
  getAuthState,
  restoreSession,
  startSession,
  subscribe,
  updateUser,
} from "@/api/auth/authStore"
import { beginSignOut, endSignOut } from "@/api/auth/redirect"
import { api } from "@/api/client"
import { apiPaths } from "@/api/endpoints"
import { isApiError, transportError, type ErrorCode } from "@/api/errors"
import type { LoginResponse, Role, UserResponse } from "@/api/types"

/**
 * React-Sicht auf den Auth-Store: Rolle, Ablauf und Passwortzwang fuer die
 * Oberflaeche, Anmelden und Abmelden als Funktionen (Ticket KAN-30,
 * Umfang 5). Die Rolle kommt aus der Login-Antwort beziehungsweise
 * GET /auth/me, nie aus dem Token: der Server liest Rolle und Status bei
 * jedem Request aus der Datenbank (Contract 6.5), der Client stuetzt
 * deshalb keine Rechteentscheidung auf den Token-Inhalt.
 */
export type AuthContextValue = {
  /** Angemeldete Person oder null. */
  user: UserResponse | null
  /** Bequemlichkeit fuer die Anzeige; die Pruefung liegt im Server (Contract 5). */
  role: Role | null
  isAuthenticated: boolean
  /** ISO-Zeitpunkt des Tokenablaufs, fuer Vorwarnungen spaeterer Seiten. */
  expiresAt: string | null
  /** Erzwungene Passwortaenderung nach Contract 6.7. */
  passwordChangeRequired: boolean
  /** Warum die letzte Sitzung endete; die Login-Seite zeigt und raeumt ihn. */
  sessionNotice: ErrorCode | null
  clearSessionNotice: () => void
  /**
   * Wirft ApiError (LOGIN_FAILED, ACCOUNT_NOT_ACTIVE, ...); das Formular
   * entscheidet ueber errorCode.
   *
   * <p>Gibt die angemeldete Person zurueck (KAN-83). Die Login-Seite
   * braucht die Rolle unmittelbar nach dem Aufruf, um das Startziel zu
   * waehlen; `useAuth` traegt an dieser Stelle noch den Stand des
   * vorherigen Renders, und `getAuthState` direkt anzuzapfen zoege eine
   * zweite Wahrheit neben den Kontext.
   */
  login: (email: string, password: string) => Promise<UserResponse>
  logout: () => Promise<void>
  /** Frische Nutzerdaten aus GET /auth/me, etwa nach einer Profilaenderung. */
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  /*
   * Sitzung einmal je Provider aus dem localStorage heben, vor dem ersten
   * Abonnement. In StrictMode laeuft der Initialisierer doppelt; die
   * Wiederherstellung ist idempotent.
   */
  useState(() => {
    restoreSession()
    return null
  })

  const state = useSyncExternalStore(subscribe, getAuthState)

  /*
   * Ende des Abmeldevorgangs: sobald die Anwendung den abgemeldeten
   * Zustand einmal gerendert hat, ist er vorbei, und die Rueckkehr-Route
   * wird wieder gemerkt (redirect.ts, endSignOut). Dieser Effekt ist der
   * Ort dafuer, weil der Provider ueber dem Router steht: React fuehrt ihn
   * erst aus, wenn RequireAuth und RequireRole ihre Entscheidung fuer
   * diesen Zustand bereits getroffen haben. Ein Zuruecksetzen direkt nach
   * endSession() haette dagegen davon abgehangen, wann React den Render
   * dazwischenlegt.
   *
   * Ein gesetzter Merker geht nie verloren: beginSignOut() ruft nur
   * logout(), und das ist nur mit bestehender Sitzung erreichbar; der
   * Wechsel auf "abgemeldet" folgt also immer.
   */
  const isSignedOut = state.session === null
  useEffect(() => {
    if (isSignedOut) {
      endSignOut()
    }
  }, [isSignedOut])

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<LoginResponse>(apiPaths.auth.login, {
      email,
      password,
    })
    /*
     * Die generierten Felder sind optional, weil springdoc kein required
     * markiert. Fehlt eines der drei tragenden Felder tatsaechlich, ist die
     * Antwort kein brauchbares Login und wird wie ein Transportfehler
     * behandelt, statt eine halbe Sitzung anzulegen.
     */
    if (
      response.token === undefined ||
      response.expiresAt === undefined ||
      response.user === undefined
    ) {
      throw transportError(apiPaths.auth.login)
    }
    startSession({
      token: response.token,
      expiresAt: response.expiresAt,
      user: response.user,
      passwordChangeRequired: response.passwordChangeRequired,
    })
    return response.user
  }, [])

  const logout = useCallback(async () => {
    /*
     * Vor dem Request und nicht erst nach der Antwort: ab hier merkt sich
     * niemand mehr die aktuelle Route, damit das naechste Anmelden wieder
     * auf dem Ziel der Rolle landet und nicht dort, wo diese Sitzung
     * endete (redirect.ts, beginSignOut). Ein Sitzungsablauf ist
     * ausdruecklich etwas anderes und merkt weiter.
     */
    beginSignOut()
    try {
      await api.post<void>(apiPaths.auth.logout)
    } catch (error) {
      /*
       * Die Abmeldung besteht darin, dass der Client das Token verwirft;
       * der Server kann ein zustandsloses JWT ohnehin nicht entwerten
       * (Contract 6.5). Ein Fehler des Aufrufs (Server weg, Token schon
       * abgelaufen) darf die lokale Abmeldung deshalb nicht verhindern.
       */
      if (!isApiError(error)) {
        throw error
      }
    } finally {
      endSession()
    }
  }, [])

  const refreshUser = useCallback(async () => {
    const user = await api.get<UserResponse>(apiPaths.auth.me)
    updateUser(user)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state.session?.user ?? null,
      role: state.session?.user.role ?? null,
      isAuthenticated: state.session !== null,
      expiresAt: state.session?.expiresAt ?? null,
      passwordChangeRequired: state.session?.passwordChangeRequired ?? false,
      sessionNotice: state.sessionNotice,
      clearSessionNotice,
      login,
      logout,
      refreshUser,
    }),
    [state, login, logout, refreshUser]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components -- Kontext und Hook gehoeren zusammen; ein eigenes Hook-Modul wuerde nur den Importpfad verdoppeln.
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (value === null) {
    throw new Error("useAuth verlangt einen AuthProvider oberhalb im Baum.")
  }
  return value
}
