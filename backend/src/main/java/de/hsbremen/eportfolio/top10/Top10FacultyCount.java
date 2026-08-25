package de.hsbremen.eportfolio.top10;

import java.util.UUID;

/**
 * Zahl der Projekte einer Fakultaet in der Kuratierung, Ergebniszeile von
 * {@link Top10EntryRepository#countPerFaculty()} und
 * {@link Top10NominationRepository#countProjectsPerFacultyByStatus}.
 *
 * <p>Kein DTO der API, sondern ein Abfrageergebnis wie
 * {@code ProjectFacultyCount}: die Felder {@code inTop10} und {@code accepted}
 * der Kennzahl {@code projectsByFaculty} entstehen daraus (§6.1, Contract v82).
 *
 * <p>Ein Record fuer beide Abfragen, weil beide dieselbe Form haben, naemlich
 * Fakultaets-ID und Zahl. Zwei fast gleiche Records waeren dieselbe Aussage in
 * zwei Gestalten, und der Dienst faellt fuer beide auf 0 zurueck.
 *
 * @param facultyId ID der Fakultaet, zu der gezaehlt wurde
 * @param count     Zahl der Projekte. Fakultaeten ohne Treffer kommen in der
 *                  Ergebnisliste gar nicht vor; der Dienst ergaenzt sie mit 0
 */
public record Top10FacultyCount(UUID facultyId, long count) {
}
