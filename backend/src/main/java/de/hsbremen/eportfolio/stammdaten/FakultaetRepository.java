package de.hsbremen.eportfolio.stammdaten;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Fakultaeten.
 */
public interface FakultaetRepository extends JpaRepository<Fakultaet, UUID> {

	/** Alle Fakultaeten nach Name aufsteigend (§6.1). */
	List<Fakultaet> findAllByOrderByNameAsc();

	/**
	 * Suche ueber das Kuerzel ({@code fakultaet.kuerzel} ist unique). Wird vom
	 * {@link DevStammdatenSeeder} gebraucht, damit ein zweiter Lauf nichts
	 * doppelt anlegt.
	 */
	Optional<Fakultaet> findByKuerzel(String kuerzel);
}
