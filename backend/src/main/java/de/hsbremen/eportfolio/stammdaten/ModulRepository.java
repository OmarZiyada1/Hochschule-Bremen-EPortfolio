package de.hsbremen.eportfolio.stammdaten;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Module.
 */
public interface ModulRepository extends JpaRepository<Modul, UUID> {

	List<Modul> findByStudiengangId(UUID studiengangId);
}
