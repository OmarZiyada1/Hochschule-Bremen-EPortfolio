package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.enums.NominationStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Datenbankzugriff auf Top-10-Nominierungen.
 *
 * <p>Die Lesemethoden fuer {@code GET /api/admin/top10-nominations} und
 * {@code GET /api/top10-nominations} tragen einen {@code @EntityGraph} ueber
 * Projekt, Nominierende und Entscheidende: die Antwort zeigt zu jeder Zeile eine
 * Projektkachel und beide Personen, ohne den Graph laedt Hibernate das je Zeile
 * einzeln nach. Modul und Semester stehen seit Contract v68 dabei, weil die
 * Kachel beide fuehrt (§6.1).
 *
 * <p>Sortiert wird durchgehend nach {@code createdAt} absteigend, also neueste
 * Vorschlaege zuerst. §6.1 legt fuer diesen Endpoint keine Sortierung fest; ein
 * Protokoll ohne feste Ordnung waere in der Admin-Ansicht aber bei jedem Aufruf
 * anders angeordnet. Die ID haengt als Gleichstandsbrecher hinten an, wie in
 * {@code ProjectReadService}.
 */
public interface Top10NominationRepository extends JpaRepository<Top10Nomination, UUID> {

	@EntityGraph(attributePaths = {"project", "project.author", "project.category",
			"project.faculty", "project.studyProgram", "project.module", "project.semester",
			"nominatedBy", "decidedBy"})
	List<Top10Nomination> findAllByOrderByCreatedAtDescIdAsc();

	@EntityGraph(attributePaths = {"project", "project.author", "project.category",
			"project.faculty", "project.studyProgram", "project.module", "project.semester",
			"nominatedBy", "decidedBy"})
	List<Top10Nomination> findByStatusOrderByCreatedAtDescIdAsc(NominationStatus status);

	/**
	 * {@code GET /api/top10-nominations?nominatedBy=me} (§6.1, seit Contract
	 * v68): die eigenen Vorschlaege einer Redakteur:in, neueste zuerst.
	 *
	 * <p>Dieselbe Ordnung und derselbe Graph wie beim Admin-Spiegel; der
	 * Unterschied ist allein die Einschraenkung auf die nominierende Person.
	 */
	@EntityGraph(attributePaths = {"project", "project.author", "project.category",
			"project.faculty", "project.studyProgram", "project.module", "project.semester",
			"nominatedBy", "decidedBy"})
	List<Top10Nomination> findByNominatedByIdOrderByCreatedAtDescIdAsc(UUID nominatedById);

	@EntityGraph(attributePaths = {"project", "project.author", "project.category",
			"project.faculty", "project.studyProgram", "project.module", "project.semester",
			"nominatedBy", "decidedBy"})
	List<Top10Nomination> findByNominatedByIdAndStatusOrderByCreatedAtDescIdAsc(UUID nominatedById,
			NominationStatus status);

	List<Top10Nomination> findByProjectId(UUID projectId);

	/** §3.11.1 Regel 2: hoechstens eine offene Nominierung je Projekt. */
	boolean existsByProjectIdAndStatus(UUID projectId, NominationStatus status);

	/**
	 * Kennzahl {@code openNominations} des Admin-Dashboards (§6.1): die
	 * Vorschlaege, ueber die noch zu entscheiden ist, also {@code PENDING}
	 * (§2.8).
	 */
	long countByStatus(NominationStatus status);

	/**
	 * Je Fakultaet die Zahl der <em>Projekte</em> mit einer Nominierung in
	 * diesem Stand (§6.1, Contract v82).
	 *
	 * <p><strong>{@code count(distinct n.project.id)} und nicht
	 * {@code count(n)}.</strong> Ein Projekt kann mehrfach nominiert worden
	 * sein, etwa nachdem ein erster Vorschlag zurueckgezogen wurde (§2.8).
	 * Gezaehlt werden sollen aber Projekte und keine Vorgaenge, sonst stuende
	 * im Balken eine Zahl, die groesser sein kann als der Bestand der Fakultaet.
	 *
	 * <p>Projekte ohne Fakultaet fallen heraus, wie bei
	 * {@link Top10EntryRepository#countPerFaculty()}.
	 */
	@Query("select new de.hsbremen.eportfolio.top10.Top10FacultyCount("
			+ "n.project.faculty.id, count(distinct n.project.id)) "
			+ "from Top10Nomination n "
			+ "where n.status = :status and n.project.faculty is not null "
			+ "group by n.project.faculty.id")
	List<Top10FacultyCount> countProjectsPerFacultyByStatus(
			@Param("status") NominationStatus status);

	/**
	 * Die offenen Nominierungen zu einer Menge von Projekten, fuer den Fall, dass
	 * der Admin ein Projekt ueber {@code PUT /api/admin/top10} direkt aufnimmt und
	 * die dazu vorliegenden Vorschlaege damit entschieden sind.
	 */
	List<Top10Nomination> findByStatusAndProjectIdIn(NominationStatus status,
			List<UUID> projectIds);

	/**
	 * Nur die Projekt-IDs zu einem Stand, fuer {@code hasOpenNomination} an der
	 * Projektantwort (§3.11, seit Contract v90).
	 *
	 * <p><strong>Eine Projektion und nicht die Entitaeten.</strong> Der
	 * Lesedienst braucht hier eine Ja-Nein-Auskunft je Kachel und sonst nichts;
	 * {@link #findByStatusAndProjectIdIn} laedt dafuer zu viel, und mit dem
	 * {@code @EntityGraph} der Listenmethoden waere es ein Vielfaches davon.
	 *
	 * <p>{@code distinct}, weil ein Projekt im Lauf seines Lebens mehrfach
	 * nominiert worden sein kann (§2.8); offen ist davon nach Regel 2 aus
	 * §3.11.1 zwar hoechstens einer, aber die Zusage der Abfrage soll nicht an
	 * einer Invariante haengen, die anderswo durchgesetzt wird.
	 */
	@Query("select distinct n.project.id from Top10Nomination n "
			+ "where n.status = :status and n.project.id in :projectIds")
	List<UUID> findProjectIdsByStatusAndProjectIdIn(@Param("status") NominationStatus status,
			@Param("projectIds") List<UUID> projectIds);
}
