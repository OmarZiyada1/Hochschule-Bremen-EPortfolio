package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.common.enums.ProjectStatus;

/**
 * Zahl der Projekte je Status, Ergebniszeile von
 * {@link ProjectRepository#countPerStatus()}.
 *
 * <p>Kein DTO der API, sondern ein Abfrageergebnis wie {@code ReactionCount}:
 * die Kennzahl {@code projectsByStatus} des Admin-Dashboards (§6.1) entsteht
 * daraus.
 *
 * @param status Status, zu dem gezaehlt wurde
 * @param count  Zahl der Projekte in diesem Status. Status ohne Projekt kommen
 *               in der Ergebnisliste gar nicht vor; der Dienst ergaenzt sie
 *               mit 0
 */
public record ProjectStatusCount(ProjectStatus status, long count) {
}
