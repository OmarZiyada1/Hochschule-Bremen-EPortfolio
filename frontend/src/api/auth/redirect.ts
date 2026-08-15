/**
 * Navigationsbruecke fuer die zentrale Fehlerreaktion. Client, Store und
 * QueryClient sind keine Komponenten und koennen useNavigate nicht rufen;
 * main.tsx haengt hier die navigate-Funktion des Routers ein, Tests einen
 * Spy. Ohne Verdrahtung passiert nichts: das ist im Testlauf erwuenscht und
 * in der Anwendung ausgeschlossen, weil main.tsx die Bruecke immer setzt.
 */

/** Ziel der 401-Reaktion; die Seite entsteht mit KAN-31. */
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
