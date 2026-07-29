package de.hsbremen.eportfolio.stammdaten;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Module.
 *
 * <p>Zum {@code @EntityGraph} gilt dasselbe wie im {@link StudiengangRepository}:
 * {@code ModulAntwort} liefert die Studiengang-ID mit, die sonst je Zeile
 * einzeln nachgeladen wuerde.
 */
public interface ModulRepository extends JpaRepository<Modul, UUID> {

	/** Alle Module nach Name aufsteigend (§6.1). */
	@EntityGraph(attributePaths = "studiengang")
	List<Modul> findAllByOrderByNameAsc();

	/** Module eines Studiengangs, nach Name aufsteigend — Filter aus §6.1. */
	@EntityGraph(attributePaths = "studiengang")
	List<Modul> findByStudiengangIdOrderByNameAsc(UUID studiengangId);

	/**
	 * Suche ueber den fachlichen Schluessel innerhalb eines Studiengangs, fuer
	 * den {@link DevStammdatenSeeder}.
	 */
	Optional<Modul> findByStudiengangIdAndName(UUID studiengangId, String name);
}
