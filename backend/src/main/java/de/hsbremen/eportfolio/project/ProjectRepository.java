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
	 * laedt Hibernate Autor, Kategorie, Fakultaet, Studiengang, Modul und
	 * Semester je Kachel einzeln nach (N+1). Alle sind {@code @ManyToOne},
	 * lassen sich also gefahrlos mitziehen; eine Sammlung im selben Graph wuerde
	 * die Paginierung dagegen in den Arbeitsspeicher verlagern (deshalb
	 * {@code @BatchSize} an {@code Project.tags}).
	 *
	 * <p>Das Modul steht seit Contract v68 dabei (KAN-37). Bis dahin fehlte es
	 * bewusst, weil die Kachel es nicht zeigte; seit „Meine Reviews" eine Spalte
	 * „Fach" fuehrt, zeigt sie es, und ohne den Graph entstuende genau das N+1,
	 * das er verhindern soll. Das Semester kam aus demselben Grund mit KAN-65
	 * dazu (§3.18).
	 */
	@Override
	@EntityGraph(attributePaths = {"author", "category", "faculty", "studyProgram", "module",
			"semester"})
	Page<Project> findAll(Specification<Project> specification, Pageable pageable);

	/**
	 * Ein Projekt samt seiner Stammdatenbezuege fuer
	 * {@code GET /api/projects/{id}}. Hier ist auch das Modul dabei, weil die
	 * Detailansicht es anzeigt.
	 *
	 * <p><strong>{@code editors} seit Contract v55 im Graph.</strong> Die
	 * Sammlung ist LAZY und blieb bei einem anonymen Aufruf frueher ungeladen,
	 * weil die Sichtbarkeitspruefung kurzschloss. Seit die Redaktion eines
	 * veroeffentlichten Projekts oeffentlich ist (§3.3), wird sie bei jedem
	 * Aufruf gebraucht, und das ist der meistbesuchte Lesepfad der Anwendung.
	 * Eine zweite Abfrage je Seitenaufruf spart der Graph ein; ein kartesisches
	 * Problem entsteht nicht, weil die Abfrage genau eine Zeile liefert.
	 */
	@EntityGraph(attributePaths = {"author", "category", "faculty", "studyProgram", "module",
			"semester", "editors"})
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
	 * Kategorie, Fakultaet, Studiengang und Modul je Kachel einzeln nach (N+1).
	 *
	 * <p>Sortiert nach Veroeffentlichungsdatum, neueste zuerst. Das Feld ist bei
	 * einem {@code PUBLISHED}-Projekt gesetzt (§3.3), und ein Profil ordnet seine
	 * Arbeiten sinnvoll danach, seit wann sie zu sehen sind. Die ID haengt als
	 * Gleichstandsbrecher hinten an, damit zwei am selben Zeitpunkt
	 * veroeffentlichte Projekte zwischen zwei Aufrufen nicht die Plaetze
	 * tauschen.
	 */
	@EntityGraph(attributePaths = {"author", "category", "faculty", "studyProgram", "module",
			"semester"})
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
	// gemeinsame: alle fuenf Spalten sind nullable, ein Projekt kann also an
	// keiner, einer oder allen fuenf Zeilen haengen.
	// ------------------------------------------------------------------

	boolean existsByCategoryId(UUID categoryId);

	boolean existsByFacultyId(UUID facultyId);

	boolean existsByStudyProgramId(UUID studyProgramId);

	boolean existsByModuleId(UUID moduleId);

	boolean existsBySemesterId(UUID semesterId);

	/**
	 * Die Projekte einer Kategorie, fuer
	 * {@code POST /api/admin/categories/{id}/merge} (§6.1, KAN-46).
	 *
	 * <p><strong>Warum die Zeilen geladen werden und kein {@code update … set
	 * category = …} laeuft.</strong> Ein Massen-UPDATE in JPQL ginge an
	 * {@code @Version} und {@code @LastModifiedDate} vorbei: die
	 * {@code version} bliebe stehen, und ein gleichzeitig geoeffneter Editor
	 * schriebe die alte Kategorie beim naechsten Speichern stillschweigend
	 * zurueck, statt in 409 {@code PROJECT_VERSION_CONFLICT} zu laufen (§6.4).
	 * Der Preis ist bekannt und getragen: die betroffenen Projekte bekommen ein
	 * neues {@code updatedAt} und ruecken in der danach sortierten Liste nach
	 * vorn. Entschieden in der Klaerungsrunde zu KAN-46.
	 *
	 * <p>Ohne {@code @EntityGraph}: gebraucht wird allein die Zeile selbst, und
	 * die Antwort des Endpoints ist die Zielkategorie und keine Projektliste.
	 */
	List<Project> findByCategoryId(UUID categoryId);
}
