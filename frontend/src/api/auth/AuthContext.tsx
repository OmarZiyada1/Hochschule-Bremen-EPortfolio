import {
  createContext,
  useCallback,
  useContext,
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
  /** Wirft ApiError (LOGIN_FAILED, ACCOUNT_NOT_ACTIVE, ...); das Formular entscheidet ueber errorCode. */
  login: (email: string, password: string) => Promise<void>
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
  }, [])

  const logout = useCallback(async () => {
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
