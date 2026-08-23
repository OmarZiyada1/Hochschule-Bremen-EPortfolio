import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"

import {
  endSession,
  getAuthState,
  setPasswordChangeRequired,
  subscribe,
} from "@/api/auth/authStore"
import {
  CHANGE_PASSWORD_PATH,
  LOGIN_PATH,
  navigateForAuth,
  rememberRequestedRoute,
} from "@/api/auth/redirect"
import { isApiError } from "@/api/errors"
import { isObjectUrlQueryKey } from "@/api/queries/files"

/**
 * Zentrale Reaktion auf die Fehlercodes aus Contract 6.2: einmal hier,
 * nicht je Seite (Ticket KAN-30, Umfang 4).
 *
 * - 401 NOT_AUTHENTICATED, TOKEN_INVALID, TOKEN_EXPIRED: Token verwerfen,
 *   Hinweis im Auth-Store hinterlassen, zum Login. Nie eine leere Seite.
 * - 403 PASSWORD_CHANGE_REQUIRED: zur Passwortseite umleiten statt einer
 *   Meldung; das Gate laesst nur die fuenf Ausnahmen aus Contract 6.7
 *   durch, ohne Weiterleitung saehe die Person nur eine Sperre ohne Ausweg.
 *   Die Sitzung bleibt bestehen, der Zustand wandert in den Store.
 *
 * Alles andere laeuft unveraendert an die aufrufende Stelle durch: 403
 * NO_PERMISSION wird dort als Meldung sichtbar (ohne Weiterleitung), 400
 * VALIDATION_FAILED gehoert ans Formularfeld, 409 PROJECT_VERSION_CONFLICT
 * entscheidet die aufrufende Stelle selbst und wird nie automatisch
 * wiederholt (Contract 6.4). 401 ACCOUNT_NOT_ACTIVE bleibt ebenfalls bei
 * der aufrufenden Stelle: beim Login gehoert die Meldung ans Formular
 * (KAN-31), und das Ticket nennt fuer das zentrale Sitzungsende bewusst nur
 * die drei Token-Codes.
 */
export function reactToSessionError(error: unknown): void {
  if (!isApiError(error)) {
    return
  }
  switch (error.errorCode) {
    case "NOT_AUTHENTICATED":
    case "TOKEN_INVALID":
    case "TOKEN_EXPIRED":
      /*
       * Die aktuelle Route merken, bevor sie verlassen wird: nach der
       * erneuten Anmeldung geht es dorthin zurueck statt zur Projektliste
       * (Klaerungsrunde KAN-33). window.location, weil diese Reaktion
       * ausserhalb von Komponenten laeuft und keinen Router-Hook hat.
       */
      rememberRequestedRoute(window.location.pathname + window.location.search)
      endSession(error.errorCode)
      navigateForAuth(LOGIN_PATH)
      break
    case "PASSWORD_CHANGE_REQUIRED":
      rememberRequestedRoute(window.location.pathname + window.location.search)
      setPasswordChangeRequired(true)
      navigateForAuth(CHANGE_PASSWORD_PATH)
      break
    default:
      break
  }
}

/**
 * Ein QueryClient je Anwendung (main.tsx) und je Test (tests/render.tsx),
 * immer ueber diese Fabrik, damit die zentrale Fehlerreaktion nirgends
 * fehlt.
 *
 * retry: false fuer Queries wie Mutationen: die Fehlertabelle des Tickets
 * kennt keinen Code, bei dem ein automatischer neuer Versuch richtig waere.
 * Bei 409 PROJECT_VERSION_CONFLICT wuerde er genau die fremde Aenderung
 * ueberschreiben, vor der das Optimistic Locking schuetzt (Contract 6.4),
 * bei 429 die Sperre verlaengern, bei 500 den Fehler nur verzoegern.
 */
export function createQueryClient(): QueryClient {
  const client = new QueryClient({
    queryCache: new QueryCache({
      onError: reactToSessionError,
    }),
    mutationCache: new MutationCache({
      onError: reactToSessionError,
    }),
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  /*
   * Bei jedem Sitzungswechsel wird der Cache geleert, in beide Richtungen:
   * Nach einer Abmeldung blieben sonst personenbezogene Antworten der alten
   * Sitzung am geteilten Rechner abrufbar. Nach einer Anmeldung lieferte
   * derselbe Query-Key zunaechst die anonyme Antwort weiter, obwohl der
   * Server je Rolle verschieden antwortet (Contract 5): wer die Liste
   * anonym besucht und sich dann anmeldet, saehe bei einem scheiternden
   * Refetch weiter nur PUBLISHED. Der Weg ueber den Store deckt alle
   * Ausloeser ab: Login, zentrale 401-Reaktion, Ablauf-Timer und Logout.
   * Das Abo lebt so lange wie der Client, also so lange wie die Anwendung
   * beziehungsweise der einzelne Test.
   */
  /*
   * Object-URLs gehoeren dem Cache und werden mit ihm freigegeben
   * (fileQueries.objectUrl). Ohne diese Zeile haelt der Browser jedes je
   * gezeigte Bild bis zum Neuladen der Seite im Speicher; ein Beitrag mit
   * einer Galerie kommt schnell auf zweistellige Megabyte. "removed" ist
   * der einzige Zeitpunkt, an dem die Adresse sicher niemand mehr
   * anzeigt: er faellt nach der Aufraeumfrist des letzten Verwenders und
   * bei client.clear() darunter.
   */
  client.getQueryCache().subscribe((event) => {
    if (event.type !== "removed" || !isObjectUrlQueryKey(event.query.queryKey)) {
      return
    }
    const url: unknown = event.query.state.data
    if (typeof url === "string") {
      URL.revokeObjectURL(url)
    }
  })

  let hadSession = getAuthState().session !== null
  subscribe(() => {
    const hasSession = getAuthState().session !== null
    if (hadSession !== hasSession) {
      client.clear()
    }
    hadSession = hasSession
  })

  return client
}
