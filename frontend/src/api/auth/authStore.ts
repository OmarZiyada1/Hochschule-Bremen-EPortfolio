import type { ErrorCode } from "@/api/errors"
import { LOGIN_PATH, navigateForAuth } from "@/api/auth/redirect"
import type { UserResponse } from "@/api/types"

/**
 * Sitzungszustand ausserhalb von React: der HTTP-Client braucht das Token,
 * die zentrale Fehlerreaktion beendet die Sitzung, und beide sind keine
 * Komponenten. Der AuthContext ist die React-Sicht auf diesen Store
 * (useSyncExternalStore), nicht eine zweite Wahrheit daneben.
 *
 * Token und Nutzer liegen im Speicher plus localStorage (Ticket KAN-30,
 * Umfang 5), damit ein Neuladen der Seite die Sitzung nicht beendet.
 *
 * Rolle und Status werden serverseitig bei jedem Request aus der Datenbank
 * gelesen (Contract 6.5). Was hier liegt, ist Anzeige-Bequemlichkeit und
 * keine Rechteentscheidung: eine ausgeblendete Schaltflaeche ersetzt keine
 * Pruefung, und ein trotzdem eintreffender 403 wird sichtbar behandelt.
 */

export type AuthSession = {
  token: string
  /** ISO-Zeitpunkt aus der Login-Antwort; danach ist das Token wertlos. */
  expiresAt: string
  user: UserResponse
  /** Erzwungene Passwortaenderung nach Contract 6.7. */
  passwordChangeRequired: boolean
}

export type AuthState = {
  session: AuthSession | null
  /**
   * Warum die letzte Sitzung endete (TOKEN_EXPIRED, TOKEN_INVALID, ...).
   * Die Login-Seite (KAN-31) zeigt den Hinweis an und raeumt ihn ab; so ist
   * die 401-Reaktion sichtbar, ohne dass dieses Ticket eine eigene
   * Meldungsflaeche baut (Klaerungsrunde KAN-30).
   */
  sessionNotice: ErrorCode | null
}

const STORAGE_KEY = "eportfolio.session"

/*
 * setTimeout nimmt hoechstens 2^31-1 ms (knapp 25 Tage); ein groesserer
 * Wert feuert sofort. Laengere Restlaufzeiten werden deshalb in Etappen
 * geplant und beim Feuern erneut gegen die Uhr geprueft.
 */
const MAX_TIMEOUT_MS = 2_147_483_647

let state: AuthState = { session: null, sessionNotice: null }
const listeners = new Set<() => void>()
let expiryTimer: ReturnType<typeof setTimeout> | null = null

function emit(next: AuthState): void {
  state = next
  for (const listener of listeners) {
    listener()
  }
}

function persist(session: AuthSession | null): void {
  if (session === null) {
    window.localStorage.removeItem(STORAGE_KEY)
  } else {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }
}

function clearExpiryTimer(): void {
  if (expiryTimer !== null) {
    clearTimeout(expiryTimer)
    expiryTimer = null
  }
}

/**
 * Plant das sichtbare Sitzungsende auf den Ablaufzeitpunkt, statt auf den
 * ersten 401 zu warten (Ticket KAN-30, Umfang 5): bei Ablauf endet die
 * Sitzung mit Hinweis TOKEN_EXPIRED und Weiterleitung zum Login. Fuer eine
 * Vorwarnung stellt der Kontext expiresAt bereit; sie selbst ist Sache der
 * Seiten-Tickets (Klaerungsrunde KAN-30).
 */
function scheduleExpiry(expiresAt: string): void {
  clearExpiryTimer()
  const remaining = new Date(expiresAt).getTime() - Date.now()
  expiryTimer = setTimeout(
    () => {
      expiryTimer = null
      if (state.session === null) {
        return
      }
      if (new Date(state.session.expiresAt).getTime() - Date.now() > 0) {
        scheduleExpiry(state.session.expiresAt)
        return
      }
      endSession("TOKEN_EXPIRED")
      navigateForAuth(LOGIN_PATH)
    },
    Math.max(0, Math.min(remaining, MAX_TIMEOUT_MS))
  )
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAuthState(): AuthState {
  return state
}

export function getToken(): string | null {
  return state.session?.token ?? null
}

export function startSession(session: AuthSession): void {
  persist(session)
  scheduleExpiry(session.expiresAt)
  emit({ session, sessionNotice: null })
}

/**
 * Beendet die Sitzung lokal: Token verwerfen, Speicher raeumen. Mehr kann
 * eine Abmeldung bei einem zustandslosen JWT nicht tun; der Server entwertet
 * das Token nicht (Contract 6.5, dokumentiertes Verhalten).
 */
export function endSession(notice: ErrorCode | null = null): void {
  clearExpiryTimer()
  persist(null)
  emit({ session: null, sessionNotice: notice })
}

export function clearSessionNotice(): void {
  if (state.sessionNotice !== null) {
    emit({ ...state, sessionNotice: null })
  }
}

/** Nach GET /auth/me: frische Nutzerdaten, Sitzung bleibt bestehen. */
export function updateUser(user: UserResponse): void {
  if (state.session !== null) {
    const session = { ...state.session, user }
    persist(session)
    emit({ ...state, session })
  }
}

/**
 * Gesetzt von der zentralen 403-Reaktion (PASSWORD_CHANGE_REQUIRED) und
 * zurueckgesetzt, sobald PUT /auth/password durch ist (KAN-33).
 */
export function setPasswordChangeRequired(value: boolean): void {
  if (
    state.session !== null &&
    state.session.passwordChangeRequired !== value
  ) {
    const session = { ...state.session, passwordChangeRequired: value }
    persist(session)
    emit({ ...state, session })
  }
}

function isStoredSession(value: unknown): value is AuthSession {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).token === "string" &&
    typeof (value as Record<string, unknown>).expiresAt === "string" &&
    typeof (value as Record<string, unknown>).user === "object" &&
    typeof (value as Record<string, unknown>).passwordChangeRequired ===
      "boolean"
  )
}

/**
 * Stellt die Sitzung aus dem localStorage wieder her, beim Laden der
 * Anwendung und in Tests nach praepariertem Speicher. Eine abgelaufene oder
 * unlesbare Sitzung wird nicht wiederhergestellt; abgelaufen hinterlaesst
 * den Hinweis TOKEN_EXPIRED, damit die Reaktion sichtbar ist und keine
 * leere Seite entsteht.
 */
export function restoreSession(): void {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    persist(null)
    return
  }
  if (!isStoredSession(parsed)) {
    persist(null)
    return
  }
  if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
    persist(null)
    emit({ session: null, sessionNotice: "TOKEN_EXPIRED" })
    return
  }
  scheduleExpiry(parsed.expiresAt)
  emit({ session: parsed, sessionNotice: null })
}

/** Nur fuer Tests: zurueck auf den Ausgangszustand, ohne Hinweis. */
export function resetAuthStoreForTests(): void {
  clearExpiryTimer()
  persist(null)
  emit({ session: null, sessionNotice: null })
}
