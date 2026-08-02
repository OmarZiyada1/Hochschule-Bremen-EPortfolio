package de.hsbremen.eportfolio.reaktion;

import java.util.UUID;

/**
 * Zahl der Reaktionen eines Projekts, Ergebniszeile von
 * {@link ReaktionRepository#zaehleJeProjekt(java.util.Collection)}.
 *
 * <p>Kein DTO der API, sondern ein Abfrageergebnis: die Kachel zeigt die Zahl
 * unter {@code reaktionAnzahl}. Es gibt dieses Record, weil die Alternative,
 * {@code countByProjektId} je Treffer aufzurufen, genau das N+1-Verhalten
 * erzeugen wuerde, das die Kachelliste vermeiden soll.
 *
 * @param projektId Projekt, zu dem gezaehlt wurde
 * @param anzahl    Zahl der Reaktionen; Projekte ohne Reaktion kommen in der
 *                  Ergebnisliste gar nicht vor und zaehlen als 0
 */
public record ReaktionAnzahl(UUID projektId, long anzahl) {
}
