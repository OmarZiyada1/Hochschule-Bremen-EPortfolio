package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Datenbankzugriff auf die Top-10-Liste.
 */
public interface Top10EntryRepository extends JpaRepository<Top10Entry, UUID> {

	/**
	 * Die Liste, wie {@code GET /api/top10} sie ausliefert: geordnet nach Platz
	 * und auf veroeffentlichte Projekte eingegrenzt.
	 *
	 * <p><strong>Warum der Statusfilter, obwohl der Bestand ihn nicht braucht.</strong>
	 * Ein Eintrag wird entfernt, sobald sein Projekt {@code PUBLISHED} verlaesst
	 * ({@code Top10Service.removeOnLeavingPublished}); nach dieser Regel kann hier
	 * gar kein Entwurf stehen. Der Filter ist die zweite Sperre: dieser Endpoint
	 * ist der einzige der Liste, der ohne Anmeldung erreichbar ist, und §3.11.1
	 * nennt einen Entwurf auf der Startseite ausdruecklich ein Sichtbarkeitsleck.
	 * Ein kuenftiger Schreibweg, der den Entzug vergisst, faellt damit nicht der
	 * Oeffentlichkeit auf die Fuesse.
	 *
	 * <p>Der {@code @EntityGraph} hat denselben Grund wie in
	 * {@code ProjectRepository}: ohne ihn laedt Hibernate Autor, Kategorie,
	 * Fakultaet, Studiengang, Modul und Semester je Kachel einzeln nach (N+1).
	 * Modul und Semester stehen seit Contract v68 beziehungsweise KAN-65 an
	 * der Kachel (§6.1); ohne sie im Graph kostete ausgerechnet die
	 * oeffentliche Startseite zwei zusaetzliche Abfragen je Eintrag.
	 */
	@EntityGraph(attributePaths = {"project", "project.author", "project.category",
			"project.faculty", "project.studyProgram", "project.module",
			"project.semester"})
	@Query("select e from Top10Entry e where e.project.status = :status order by e.position asc")
	List<Top10Entry> findVisible(@Param("status") ProjectStatus status);

	/**
	 * Die vollstaendige Liste einschliesslich der Eintraege, deren Projekt
	 * gerade nicht veroeffentlicht ist. Grundlage jeder schreibenden Operation:
	 * belegte Plaetze bleiben belegt, auch wenn sie oeffentlich nicht erscheinen.
	 */
	@EntityGraph(attributePaths = {"project"})
	List<Top10Entry> findAllByOrderByPositionAsc();

	/**
	 * Der Platz eines Projekts, sofern es einen belegt.
	 *
	 * <p>Seit KAN-45 auch der Weg, auf dem ein Platz <em>freigegeben</em> wird
	 * ({@code Top10Service.releaseSeat}). Ein {@code deleteByProjectId} stand hier
	 * bis dahin und ist entfallen: das Protokoll muss den Platz kennen, den das
	 * Projekt gerade verliert (§3.17), und ein Loeschen nach Fremdschluessel
	 * liefert ihn nicht.
	 */
	Optional<Top10Entry> findByProjectId(UUID projectId);

	boolean existsByProjectId(UUID projectId);

	boolean existsByPosition(int position);
}
