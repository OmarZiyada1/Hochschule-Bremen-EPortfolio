package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.project.Project;
import java.util.UUID;

/**
 * Ein besetzter Platz der Top-10, wie er <em>vor</em> oder <em>nach</em> einer
 * Aenderung aussieht. Nur zur Verstaendigung mit {@link Top10AuditService}
 * gedacht, keine Entity und kein DTO.
 *
 * <p><strong>Warum es diesen Zwischentyp gibt.</strong> Das Protokoll hat genau
 * einen Schreibweg, und der bekommt zwei Listen und bildet die Differenz. Ohne
 * einen eigenen Typ muesste er entweder {@link Top10Entry}-Instanzen entgegen
 * nehmen, deren {@code position} der aufrufende Dienst gerade selbst
 * umschreibt, oder zwei parallele Karten. Das Record haelt den Platz als
 * {@code int}-Kopie fest; ein spaeteres {@code setPosition} am Eintrag kann den
 * Vorzustand damit nicht mehr verfaelschen.
 *
 * <p><strong>Warum die ID getrennt vom Projekt steht.</strong> Verglichen wird
 * ueber {@link #projectId()}, gespeichert wird {@link #project()}. In einem
 * einzigen Fall bleibt das Projekt dabei leer, naemlich beim Entzug des Platzes
 * eines Projekts, das gerade geloescht wird ({@link #withoutProject()}); die
 * Differenz muss auch dann noch wissen, um welchen Platz es ging.
 *
 * @param projectId ID des Projekts auf diesem Platz, nie {@code null}
 * @param project   das Projekt selbst, {@code null} nur nach
 *                  {@link #withoutProject()}
 * @param position  Platz 1 bis 10 (§3.11)
 */
record Top10Placement(UUID projectId, Project project, int position) {

	/** Der Platz, den ein Eintrag im Augenblick des Aufrufs belegt. */
	static Top10Placement of(Top10Entry entry) {
		return new Top10Placement(entry.getProject().getId(), entry.getProject(),
				entry.getPosition());
	}

	/**
	 * Derselbe Platz, aber ohne Verweis auf das Projekt.
	 *
	 * <p>Fuer den Entzug beim Loeschen eines Projekts
	 * ({@code Top10Service.removeOnProjectDeletion}). Zwei Gruende, und beide
	 * zeigen in dieselbe Richtung. Fachlich: der Fremdschluessel steht auf
	 * {@code on delete set null}, der Verweis waere also mit dem Commit ohnehin
	 * leer. Technisch: eine frisch geschriebene Zeile, die auf ein zum Loeschen
	 * vorgemerktes Projekt zeigt, laesst Hibernate beim Flush nicht durch
	 * ({@code TransientObjectException}), der Loesch-Endpoint endete also in
	 * einem 500. Das Ergebnis in der Datenbank ist in beiden Faellen dasselbe.
	 */
	Top10Placement withoutProject() {
		return new Top10Placement(projectId, null, position);
	}
}
