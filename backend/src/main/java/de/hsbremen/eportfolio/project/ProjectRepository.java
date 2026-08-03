package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Datenbankzugriff auf Projekte.
 *
 * <p>{@code JpaSpecificationExecutor} kommt wegen der Filterliste von
 * {@code GET /api/projects} (§6.1) dazu: neun optionale Filter plus die
 * rollenabhaengige Sichtbarkeit ergeben mehr Kombinationen, als sich mit
 * abgeleiteten Methodennamen sinnvoll abbilden liessen. Die Bausteine dazu
 * stehen in {@link ProjectSpecifications}.
 */
public interface ProjectRepository extends JpaRepository<Project, UUID>, JpaSpecificationExecutor<Project> {

	/**
	 * Gefilterte, sortierte und paginierte Projektliste.
	 *
	 * <p>Ueberschrieben nur, um den {@code @EntityGraph} anzuhaengen: ohne ihn
	 * laedt Hibernate Autor, Kategorie, Fakultaet und Studiengang je Kachel
	 * einzeln nach (N+1). Alle vier sind {@code @ManyToOne}, lassen sich also
	 * gefahrlos mitziehen; eine Sammlung im selben Graph wuerde die Paginierung
	 * dagegen in den Arbeitsspeicher verlagern (deshalb {@code @BatchSize} an
	 * {@code Project.tags}).
	 *
	 * <p>Das Modul fehlt bewusst: die Kachel zeigt es nicht (§6.1), und ein
	 * weiterer Join kostet ohne Nutzen.
	 */
	@Override
	@EntityGraph(attributePaths = {"author", "category", "faculty", "studyProgram"})
	Page<Project> findAll(Specification<Project> specification, Pageable pageable);

	/**
	 * Ein Projekt samt seiner Stammdatenbezuege fuer
	 * {@code GET /api/projects/{id}}. Hier ist auch das Modul dabei, weil die
	 * Detailansicht es anzeigt.
	 */
	@EntityGraph(attributePaths = {"author", "category", "faculty", "studyProgram", "module"})
	Optional<Project> findWithReferencesById(UUID id);

	List<Project> findByStatus(ProjectStatus status);

	List<Project> findByAuthorId(UUID authorId);

	List<Project> findByEditorsId(UUID editorId);

	/**
	 * Projekte fuer die Portfolio-Ansicht: ein Projekt zaehlt dazu, wenn die
	 * Person Autor:in oder Projektmitglied ist.
	 */
	@Query("select distinct p from Project p left join p.members m "
			+ "where p.author.id = :userId or m.user.id = :userId")
	List<Project> findByParticipation(@Param("userId") UUID userId);

	/**
	 * Wie {@link #findByParticipation(UUID)}, zusaetzlich auf einen Status
	 * eingegrenzt.
	 */
	@Query("select distinct p from Project p left join p.members m "
			+ "where (p.author.id = :userId or m.user.id = :userId) "
			+ "and p.status = :status")
	List<Project> findByParticipationAndStatus(@Param("userId") UUID userId,
			@Param("status") ProjectStatus status);
}
