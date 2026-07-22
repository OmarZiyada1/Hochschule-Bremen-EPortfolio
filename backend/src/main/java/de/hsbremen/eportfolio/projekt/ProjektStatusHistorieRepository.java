package de.hsbremen.eportfolio.projekt;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf die Statushistorie von Projekten.
 */
public interface ProjektStatusHistorieRepository extends JpaRepository<ProjektStatusHistorie, UUID> {

	List<ProjektStatusHistorie> findByProjektIdOrderByZeitpunktAsc(UUID projektId);
}
