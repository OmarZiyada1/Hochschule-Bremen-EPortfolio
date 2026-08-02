package de.hsbremen.eportfolio.projekt;

import de.hsbremen.eportfolio.common.enums.ProjektStatus;
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
 * {@code GET /api/projekte} (§6.1) dazu: neun optionale Filter plus die
 * rollenabhaengige Sichtbarkeit ergeben mehr Kombinationen, als sich mit
 * abgeleiteten Methodennamen sinnvoll abbilden liessen. Die Bausteine dazu
 * stehen in {@link ProjektSpezifikationen}.
 */
public interface ProjektRepository extends JpaRepository<Projekt, UUID>, JpaSpecificationExecutor<Projekt> {

	/**
	 * Gefilterte, sortierte und paginierte Projektliste.
	 *
	 * <p>Ueberschrieben nur, um den {@code @EntityGraph} anzuhaengen: ohne ihn
	 * laedt Hibernate Autor, Kategorie, Fakultaet und Studiengang je Kachel
	 * einzeln nach (N+1). Alle vier sind {@code @ManyToOne}, lassen sich also
	 * gefahrlos mitziehen; eine Sammlung im selben Graph wuerde die Paginierung
	 * dagegen in den Arbeitsspeicher verlagern (deshalb {@code @BatchSize} an
	 * {@code Projekt.tags}).
	 *
	 * <p>Das Modul fehlt bewusst: die Kachel zeigt es nicht (§6.1), und ein
	 * weiterer Join kostet ohne Nutzen.
	 */
	@Override
	@EntityGraph(attributePaths = {"autor", "kategorie", "fakultaet", "studiengang"})
	Page<Projekt> findAll(Specification<Projekt> spezifikation, Pageable seitenwunsch);

	/**
	 * Ein Projekt samt seiner Stammdatenbezuege fuer
	 * {@code GET /api/projekte/{id}}. Hier ist auch das Modul dabei, weil die
	 * Detailansicht es anzeigt.
	 */
	@EntityGraph(attributePaths = {"autor", "kategorie", "fakultaet", "studiengang", "modul"})
	Optional<Projekt> findMitBezuegenById(UUID id);

	List<Projekt> findByStatus(ProjektStatus status);

	List<Projekt> findByAutorId(UUID autorId);

	List<Projekt> findByRedakteureId(UUID redakteurId);

	/**
	 * Projekte fuer die Portfolio-Ansicht: ein Projekt zaehlt dazu, wenn die
	 * Person Autor:in oder Projektmitglied ist.
	 */
	@Query("select distinct p from Projekt p left join p.mitglieder m "
			+ "where p.autor.id = :userId or m.user.id = :userId")
	List<Projekt> findByBeteiligung(@Param("userId") UUID userId);

	/**
	 * Wie {@link #findByBeteiligung(UUID)}, zusaetzlich auf einen Status eingegrenzt.
	 */
	@Query("select distinct p from Projekt p left join p.mitglieder m "
			+ "where (p.autor.id = :userId or m.user.id = :userId) "
			+ "and p.status = :status")
	List<Projekt> findByBeteiligungAndStatus(@Param("userId") UUID userId,
			@Param("status") ProjektStatus status);
}
