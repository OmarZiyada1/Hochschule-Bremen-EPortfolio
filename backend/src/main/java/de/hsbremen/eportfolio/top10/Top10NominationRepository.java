package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.enums.NominationStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Top-10-Nominierungen.
 *
 * <p>Die Lesemethoden fuer {@code GET /api/admin/top10-nominations} tragen einen
 * {@code @EntityGraph} ueber Projekt, Nominierende und Entscheidende: die
 * Antwort zeigt zu jeder Zeile eine Projektkachel und beide Personen, ohne den
 * Graph laedt Hibernate das je Zeile einzeln nach.
 *
 * <p>Sortiert wird durchgehend nach {@code createdAt} absteigend, also neueste
 * Vorschlaege zuerst. §6.1 legt fuer diesen Endpoint keine Sortierung fest; ein
 * Protokoll ohne feste Ordnung waere in der Admin-Ansicht aber bei jedem Aufruf
 * anders angeordnet. Die ID haengt als Gleichstandsbrecher hinten an, wie in
 * {@code ProjectReadService}.
 */
public interface Top10NominationRepository extends JpaRepository<Top10Nomination, UUID> {

	@EntityGraph(attributePaths = {"project", "project.author", "project.category",
			"project.faculty", "project.studyProgram", "nominatedBy", "decidedBy"})
	List<Top10Nomination> findAllByOrderByCreatedAtDescIdAsc();

	@EntityGraph(attributePaths = {"project", "project.author", "project.category",
			"project.faculty", "project.studyProgram", "nominatedBy", "decidedBy"})
	List<Top10Nomination> findByStatusOrderByCreatedAtDescIdAsc(NominationStatus status);

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
	 * Die offenen Nominierungen zu einer Menge von Projekten, fuer den Fall, dass
	 * der Admin ein Projekt ueber {@code PUT /api/admin/top10} direkt aufnimmt und
	 * die dazu vorliegenden Vorschlaege damit entschieden sind.
	 */
	List<Top10Nomination> findByStatusAndProjectIdIn(NominationStatus status,
			List<UUID> projectIds);
}
