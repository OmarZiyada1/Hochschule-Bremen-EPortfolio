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
	 * Haengt an diesem Studiengang noch ein Modul? Sperrt das Loeschen des
	 * Studiengangs mit 409 {@code RESOURCE_IN_USE}, aus demselben Grund wie
	 * {@link StudyProgramRepository#existsByFacultyId}.
	 */
	boolean existsByStudyProgramId(UUID studyProgramId);
}
