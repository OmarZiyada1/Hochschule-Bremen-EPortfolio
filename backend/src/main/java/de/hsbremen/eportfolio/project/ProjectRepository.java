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

	/**
	 * Die Projektliste des oeffentlichen Profils aus
	 * {@code GET /api/portfolios/{userId}} (§3.2, KAN-22).
	 *
	 * <p><strong>Nur die eigenen Projekte</strong>, also {@code authorId = user}:
	 * §3.2 nennt genau diese Abfrage. Projekte, an denen die Person nur als
	 * Mitglied mitgewirkt hat, gehoeren nicht dazu; dafuer gaebe es
	 * {@link #findByParticipationAndStatus}, das dieses Modul bewusst nicht
	 * benutzt.
	 *
	 * <p>Der {@code @EntityGraph} hat denselben Grund wie bei
	 * {@link #findAll(Specification, Pageable)}: ohne ihn laedt Hibernate Autor,
	 * Kategorie, Fakultaet und Studiengang je Kachel einzeln nach (N+1).
	 *
	 * <p>Sortiert nach Veroeffentlichungsdatum, neueste zuerst. Das Feld ist bei
	 * einem {@code PUBLISHED}-Projekt gesetzt (§3.3), und ein Profil ordnet seine
	 * Arbeiten sinnvoll danach, seit wann sie zu sehen sind. Die ID haengt als
	 * Gleichstandsbrecher hinten an, damit zwei am selben Zeitpunkt
	 * veroeffentlichte Projekte zwischen zwei Aufrufen nicht die Plaetze
	 * tauschen.
	 */
	@EntityGraph(attributePaths = {"author", "category", "faculty", "studyProgram"})
	List<Project> findByAuthorIdAndStatusOrderByPublishedAtDescIdAsc(UUID authorId,
			ProjectStatus status);

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

	/**
	 * Kennzahl {@code projectsByStatus} des Admin-Dashboards (§6.1), ueber alle
	 * Projekte und ohne Sichtbarkeitsschranke: das Dashboard sieht nur ADMIN, und
	 * §5 gibt dieser Rolle jedes Projekt in jedem Status frei.
	 *
	 * <p>Eine Abfrage mit {@code group by} statt eines {@code countByStatus} je
	 * Enum-Wert, siehe {@link ProjectStatusCount}.
	 */
	@Query("select new de.hsbremen.eportfolio.project.ProjectStatusCount(p.status, count(p)) "
			+ "from Project p group by p.status")
	List<ProjectStatusCount> countPerStatus();

	// ------------------------------------------------------------------
	// Referenzpruefungen fuer das Loeschen von Stammdaten (§6.1, KAN-25)
	//
	// Ein DELETE auf eine noch referenzierte Stammdaten-Zeile ergibt 409
	// RESOURCE_IN_USE; andernfalls verloeren die betroffenen Projekte ihre
	// Klassifikation ohne Vorwarnung. Bewusst vier einzelne Methoden und keine
	// gemeinsame: alle vier Spalten sind nullable, ein Projekt kann also an
	// keiner, einer oder allen vier Zeilen haengen.
	// ------------------------------------------------------------------

	boolean existsByCategoryId(UUID categoryId);

	boolean existsByFacultyId(UUID facultyId);

	boolean existsByStudyProgramId(UUID studyProgramId);

	boolean existsByModuleId(UUID moduleId);
}
