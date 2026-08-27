/**
 * Navigationsbruecke fuer die zentrale Fehlerreaktion. Client, Store und
 * QueryClient sind keine Komponenten und koennen useNavigate nicht rufen;
 * main.tsx haengt hier die navigate-Funktion des Routers ein, Tests einen
 * Spy. Ohne Verdrahtung passiert nichts: das ist im Testlauf erwuenscht und
 * in der Anwendung ausgeschlossen, weil main.tsx die Bruecke immer setzt.
 */

/** Ziel der 401-Reaktion; die Route steht seit KAN-7, die Seite entsteht mit KAN-33. */
export const LOGIN_PATH = "/login"

/** Ziel bei PASSWORD_CHANGE_REQUIRED (Contract 6.7); die Seite entsteht mit KAN-33. */
export const CHANGE_PASSWORD_PATH = "/change-password"

let navigate: (to: string) => void = () => {}

export function setAuthNavigate(fn: (to: string) => void): void {
  navigate = fn
}

export function navigateForAuth(to: string): void {
  navigate(to)
}

/*
 * Merkzettel fuer die urspruenglich angefragte Route (Klaerungsrunde
 * KAN-33): wer zum Login oder zur Passwortseite umgeleitet wurde, kehrt
 * nach Erfolg dorthin zurueck statt pauschal zur Projektliste. Im
 * sessionStorage, damit der Eintrag ein Neuladen der Login-Seite uebersteht,
 * aber nicht in die naechste Browser-Sitzung hineinwirkt.
 */
const RETURN_TO_KEY = "eportfolio.returnTo"

/*
 * Auth-Seiten sind nie ein Rueckkehrziel: eine gemerkte /login-Route
 * ergaebe nach der Anmeldung eine Schleife zurueck auf das Formular.
 */
const AUTH_PATH_PREFIXES = [
  LOGIN_PATH,
  CHANGE_PASSWORD_PATH,
  "/register",
  "/forgot-password",
  "/reset-password",
]

/*
 * Ein gewolltes Abmelden ist keine Umleitung und darf deshalb keinen
 * Merkzettel hinterlassen. Ohne diesen Merker schrieben ihn die
 * Routen-Wrapper genau dann: sie rendern noch einmal, sobald endSession
 * die Sitzung verwirft, sehen dabei eine geschuetzte Route ohne Anmeldung
 * und merken sie sich. Beim naechsten Anmelden gewann dieser Eintrag gegen
 * landingPathFor(role) aus KAN-83, und wer sich aus der
 * Administrationsseite abmeldete, landete wieder dort statt auf dem Ziel
 * seiner Rolle.
 *
 * Der Merker steht nur im Speicher und nicht im sessionStorage: ein
 * Abmeldevorgang ueberdauert kein Neuladen, und ein dort vergessener Wert
 * legte den Merkzettel fuer den Rest der Browser-Sitzung still.
 */
let signOutInProgress = false

/**
 * Meldet den Beginn eines gewollten Abmeldens: bis es abgeschlossen ist,
 * schreibt {@link rememberRequestedRoute} nichts mehr, und ein noch
 * liegender Merkzettel wird verworfen (wer sich abmeldet, will nirgendwo
 * fortgesetzt werden). Aufrufer ist allein {@code AuthContext.logout},
 * und zwar vor dem Request: das Abmelden beginnt mit der Absicht und nicht
 * mit der Antwort des Servers.
 *
 * <p><strong>Zwei Wege fuehren dorthin, und beide sollen den Merkzettel
 * verwerfen.</strong> Der eine ist die Kopfleiste ({@code AppLayout}), der
 * andere das erzwungene Abmelden nach einem zurueckgesetzten Passwort
 * ({@code ResetPasswordPage}, KAN-69). Beim zweiten liegt die Frage naeher,
 * weil niemand ihn gewaehlt hat; die Antwort bleibt dieselbe: Wer sein
 * Passwort zuruecksetzt, kommt danach durch die Vordertuer wieder herein und
 * soll dort landen, wo seine Rolle beginnt. Eine gemerkte Route aus der Zeit
 * davor waere ein halber Schritt zurueck in eine Sitzung, die es nicht mehr
 * gibt (Befund des frontend-reviewers).
 *
 * <p><strong>Warum ein Merker und nicht ein Aufraeumen hinterher.</strong>
 * Die naheliegende Alternative waere, den Merkzettel am Ende des Abmeldens
 * wegzuwerfen, etwa gleich nach {@code endSession()} oder nach der
 * Weiterleitung in {@code AppLayout}. Sie taugt nicht: ob der Render der
 * Wrapper vor oder nach dieser Zeile laeuft, entscheidet React und nicht
 * diese Datei. Und der Nebenweg ueber die zentrale 401-Reaktion schreibt
 * ohnehin erst spaeter, naemlich dann, wenn eine beim Leeren des
 * Query-Caches noch montierte Abfrage ohne Token nachgeladen hat und ihr
 * 401 eintrifft. Ein Merker, den die schreibende Stelle selbst abfragt,
 * kommt ohne solche Reihenfolgen aus.
 *
 * <p>Ein <strong>Sitzungsablauf</strong> setzt ihn bewusst nicht. Dort ist
 * die Person nicht fertig, sondern wird herausgeworfen; ihre Route bleibt
 * gemerkt, damit sie nach dem erneuten Anmelden weiterarbeitet, wo sie war
 * (Klaerungsrunde KAN-33).
 */
export function beginSignOut(): void {
  signOutInProgress = true
  window.sessionStorage.removeItem(RETURN_TO_KEY)
}

/**
 * Meldet, dass das Abmelden abgeschlossen ist: ab jetzt wird wieder
 * gemerkt. Aufrufer ist der {@code AuthProvider}, sobald er den
 * abgemeldeten Zustand gerendert hat. Das ist nachweislich nach dem Render
 * der Routen-Wrapper, weil der Provider ueber ihnen im Baum steht und
 * React seine Effekte erst nach dem Rendern des ganzen Teilbaums
 * ausfuehrt. Danach fuehrt ein Link auf ein Projekt wieder wie gewohnt
 * ueber den Login dorthin zurueck (KAN-33), auch wenn man sich kurz zuvor
 * abgemeldet hat.
 */
export function endSignOut(): void {
  signOutInProgress = false
}

/**
 * Merkt sich die Route, die vor einer Umleitung zum Login bzw. zur
 * Passwortseite angefragt war. Aufrufer sind die Routen-Wrapper
 * (RequireAuth, RequireRole) und die zentrale Fehlerreaktion.
 *
 * <p>Waehrend eines gewollten Abmeldens wird nichts gemerkt (siehe
 * {@link beginSignOut}).
 */
export function rememberRequestedRoute(path: string): void {
  if (signOutInProgress) {
    return
  }
  if (AUTH_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return
  }
  window.sessionStorage.setItem(RETURN_TO_KEY, path)
}

/**
 * Liefert die gemerkte Route genau einmal und raeumt sie dabei ab; ohne
 * Eintrag null, der Aufrufer faellt dann auf sein Standardziel zurueck.
 */
export function consumeRequestedRoute(): string | null {
  const path = window.sessionStorage.getItem(RETURN_TO_KEY)
  window.sessionStorage.removeItem(RETURN_TO_KEY)
  return path
}
