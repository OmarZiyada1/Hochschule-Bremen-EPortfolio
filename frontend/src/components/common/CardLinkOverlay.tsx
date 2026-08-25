import { Link } from "react-router-dom"

import { useBreadcrumbOrigin } from "@/routes/useBreadcrumb"

/**
 * Macht die ganze Karte anklickbar, ohne den Titel als Link aufzugeben
 * (KAN-80).
 *
 * <p><strong>Warum eine Flaeche und kein Klickhandler.</strong> Bis KAN-80
 * fuehrte allein der Titel ins Projekt; wer die Kachel traf, aber nicht die
 * Buchstaben, landete nirgends. Ein {@code onClick} auf der Karte waere die
 * kuerzere Loesung und die schlechtere: Mittelklick, Strg-Klick und
 * „Link in neuem Tab oeffnen" gaebe es dann nur noch am Titel, und ohne
 * JavaScript gar nicht mehr. Diese Flaeche ist ein echter Link und
 * verhaelt sich ueberall auf der Karte wie einer.
 *
 * <p><strong>Sie ist fuer Hilfsmittel nicht da.</strong> {@code aria-hidden}
 * und {@code tabIndex} minus eins nehmen sie aus Vorlesereihenfolge und
 * Tabreihenfolge: Der Titel darueber traegt dasselbe Ziel und den Text dazu,
 * und zwei Links auf dieselbe Seite waeren ein doppelter Tabstopp je Kachel.
 *
 * <p><strong>Was darueber liegen muss, traegt {@code relative z-20}.</strong>
 * Die Flaeche liegt auf {@code z-10} und deckt alles ab, was ohne eigene Ebene
 * darunter steht. Alles, was ein eigenes Ziel hat (Personen-Links, Handlungen
 * in der Fusszeile), hebt sich deshalb selbst darueber; sonst fuehrte ein
 * Klick darauf ins Projekt statt ans eigene Ziel.
 *
 * <p>Die Karte selbst braucht {@code relative}, sonst spannt sich die Flaeche
 * ueber das naechste positionierte Elternteil und damit ueber die halbe Seite.
 *
 * <p>Die Herkunft kommt automatisch mit: Der Brotkrumenpfad des Ziels beginnt
 * dann mit dem Weg zu dieser Ansicht und nicht mit dem Standardweg
 * ({@code useBreadcrumbOrigin}).
 */
export function CardLinkOverlay({
  to,
  label,
}: {
  /** Ziel der Karte, dasselbe wie am Titel. */
  to: string
  /**
   * Nur fuer den Fall, dass es keinen Titel-Link gibt: dann traegt diese
   * Flaeche selbst den Namen und bleibt fuer Hilfsmittel sichtbar.
   */
  label?: string
}) {
  const origin = useBreadcrumbOrigin()

  if (label !== undefined) {
    return (
      <Link to={to} state={origin} className="absolute inset-0 z-10">
        <span className="sr-only">{label}</span>
      </Link>
    )
  }

  return (
    <Link
      to={to}
      state={origin}
      aria-hidden="true"
      tabIndex={-1}
      className="absolute inset-0 z-10"
    />
  )
}
