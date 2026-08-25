import { createContext, useContext, useEffect } from "react"
import { useLocation } from "react-router-dom"

/**
 * Der Router-State, mit dem eine verlinkende Ansicht ihre Herkunft mitgibt.
 *
 * <p>Eigener Typ statt eines nackten Objektliterals an jeder Aufrufstelle: der
 * Schluesselname steht damit genau einmal, und ein Tippfehler faellt beim
 * Typecheck auf und nicht erst daran, dass der Pfad wieder auf „Projekte"
 * zurueckfaellt.
 */
export interface BreadcrumbOriginState {
  breadcrumbFrom: string
}

/**
 * Die Adresse der aktuellen Seite als Herkunft fuer den naechsten Schritt.
 *
 * <p>Wer von hier aus auf eine Detailseite verlinkt, haengt das Ergebnis als
 * {@code state} an den Link. Der Brotkrumenpfad dort beginnt dann mit dem Weg
 * hierher statt mit dem Standardweg aus dem Baum: Wer ein Projekt in der
 * Projektverwaltung anklickt, sieht „Administrationsseite &rsaquo; Projekte"
 * davor und nicht „Projekte" (KAN-80).
 *
 * <p>Mit Suchteil, damit der Weg zurueck dieselbe Seite und dieselbe
 * Filterauswahl trifft, aus der man kam.
 */
export function useBreadcrumbOrigin(): BreadcrumbOriginState {
  const location = useLocation()
  return { breadcrumbFrom: `${location.pathname}${location.search}` }
}

/**
 * Der Name der aktuellen Seite fuer die letzte Ebene des Pfades.
 *
 * <p>Nur Seiten mit einem eigenen Namen brauchen ihn: Projektdetail, Review,
 * fremdes Portfolio. Der Rahmen haelt den Wert, die Seite meldet ihn ueber
 * {@link useBreadcrumbTitle}.
 *
 * <p>Eigene Datei und nicht neben {@code BreadcrumbProvider}: eine
 * Komponentendatei, die auch anderes ausfuehrt, bricht das Fast Refresh der
 * Entwicklungsumgebung (Lint {@code react-refresh/only-export-components}),
 * dieselbe Begruendung wie bei {@code lib/people.ts}.
 */
export const BreadcrumbTitleContext = createContext<
  (title: string | null) => void
>(() => {})

/**
 * Meldet den Namen der aktuellen Seite an das Band im Rahmen.
 *
 * <p><strong>Ueber einen Kontext und nicht als Prop.</strong> Das Band steht im
 * {@code AppLayout}, der Name entsteht in der Seite darunter, und zwischen
 * beiden liegt der {@code Outlet} des Routers: eine Prop haette dort keinen
 * Weg. Beim Verlassen der Seite wird zurueckgesetzt, sonst truege die
 * naechste Seite fuer einen Wimpernschlag den Titel der vorigen.
 *
 * @param title Name der Seite; {@code null} oder {@code undefined}, solange er
 *              noch laedt oder die Seite keinen eigenen fuehrt.
 */
export function useBreadcrumbTitle(title: string | null | undefined) {
  const setTitle = useContext(BreadcrumbTitleContext)
  useEffect(() => {
    setTitle(title ?? null)
    return () => setTitle(null)
  }, [setTitle, title])
}
