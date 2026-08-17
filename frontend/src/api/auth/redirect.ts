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

/**
 * Merkt sich die Route, die vor einer Umleitung zum Login bzw. zur
 * Passwortseite angefragt war. Aufrufer sind die Routen-Wrapper
 * (RequireAuth, RequireRole) und die zentrale Fehlerreaktion.
 */
export function rememberRequestedRoute(path: string): void {
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
