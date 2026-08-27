package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Module.
 *
 * <p>Zum {@code @EntityGraph} gilt dasselbe wie im
 * {@link StudyProgramRepository}: {@code ModuleResponse} liefert die
 * Studiengang-ID mit, die sonst je Zeile einzeln nachgeladen wuerde.
 */
public interface ModuleRepository extends JpaRepository<Module, UUID> {

	/** Alle Module nach Name aufsteigend (§6.1). */
	@EntityGraph(attributePaths = "studyProgram")
	List<Module> findAllByOrderByNameAsc();

	/** Module eines Studiengangs, nach Name aufsteigend: Filter aus §6.1. */
	@EntityGraph(attributePaths = "studyProgram")
	List<Module> findByStudyProgramIdOrderByNameAsc(UUID studyProgramId);

	/**
	 * Suche ueber den fachlichen Schluessel innerhalb eines Studiengangs, fuer
	 * den {@link DevMasterDataSeeder}.
	 */
	Optional<Module> findByStudyProgramIdAndName(UUID studyProgramId, String name);

	/**
	 * Haengt an diesem Studiengang noch ein <em>Fachmodul</em>? Sperrt das
	 * Loeschen des Studiengangs mit 409 {@code RESOURCE_IN_USE}, aus demselben
	 * Grund wie {@link StudyProgramRepository#existsByFacultyId}.
	 *
	 * <p><strong>Das Sammelmodul zaehlt bewusst nicht mit</strong> (§3.9, seit
	 * Contract v84). Es entsteht als Nebenwirkung des Studiengangs und wird mit
	 * ihm geloescht; zaehlte es mit, waere vom Tag der Einfuehrung an kein
	 * Studiengang mehr loeschbar, weil jeder eines traegt.
	 */
	boolean existsByStudyProgramIdAndCollectiveFalse(UUID studyProgramId);

	/**
	 * Das Sammelmodul eines Studiengangs, sofern es da ist (§3.9). Der partielle
	 * Unique-Index {@code uq_module_collective} sichert zu, dass es hoechstens
	 * eines gibt.
	 */
	Optional<Module> findByStudyProgramIdAndCollectiveTrue(UUID studyProgramId);
}
