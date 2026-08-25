package de.hsbremen.eportfolio.project;

import java.util.UUID;

/**
 * Zahl der Projekte je Fakultaet, Ergebniszeile von
 * {@link ProjectRepository#countPerFaculty()}.
 *
 * <p>Kein DTO der API, sondern ein Abfrageergebnis wie
 * {@link ProjectStatusCount}: die Kennzahl {@code projectsByFaculty} des
 * Admin-Dashboards (§6.1, Contract v76) entsteht daraus.
 *
 * <p>Die Zeile traegt nur die ID und nicht die Fakultaet selbst. Name und
 * Kuerzel holt der Dienst ohnehin vollstaendig, weil auch Fakultaeten ohne
 * Projekt in der Antwort stehen; die Entitaet hier mitzuladen brauchte einen
 * zweiten Weg fuer dieselben Daten.
 *
 * @param facultyId ID der Fakultaet, zu der gezaehlt wurde
 * @param count     Zahl der Projekte an dieser Fakultaet. Fakultaeten ohne
 *                  Projekt kommen in der Ergebnisliste gar nicht vor; der
 *                  Dienst ergaenzt sie mit 0
 */
public record ProjectFacultyCount(UUID facultyId, long count) {
}
