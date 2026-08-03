package de.hsbremen.eportfolio.masterdata;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Fakultaeten.
 */
public interface FacultyRepository extends JpaRepository<Faculty, UUID> {

	/** Alle Fakultaeten nach Name aufsteigend (§6.1). */
	List<Faculty> findAllByOrderByNameAsc();

	/**
	 * Suche ueber das Kuerzel ({@code faculty.abbreviation} ist unique). Wird vom
	 * {@link DevMasterDataSeeder} gebraucht, damit ein zweiter Lauf nichts
	 * doppelt anlegt.
	 */
	Optional<Faculty> findByAbbreviation(String abbreviation);
}
