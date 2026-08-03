package de.hsbremen.eportfolio.reaction;

import java.util.UUID;

/**
 * Zahl der Reaktionen eines Projekts, Ergebniszeile von
 * {@link ReactionRepository#countPerProject(java.util.Collection)}.
 *
 * <p>Kein DTO der API, sondern ein Abfrageergebnis: die Kachel zeigt die Zahl
 * unter {@code reactionCount}. Es gibt dieses Record, weil die Alternative,
 * {@code countByProjectId} je Treffer aufzurufen, genau das N+1-Verhalten
 * erzeugen wuerde, das die Kachelliste vermeiden soll.
 *
 * @param projectId Projekt, zu dem gezaehlt wurde
 * @param count     Zahl der Reaktionen; Projekte ohne Reaktion kommen in der
 *                  Ergebnisliste gar nicht vor und zaehlen als 0
 */
public record ReactionCount(UUID projectId, long count) {
}
