package de.hsbremen.eportfolio.projekt;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Projektmitglieder.
 */
public interface ProjektmitgliedRepository extends JpaRepository<Projektmitglied, UUID> {

	List<Projektmitglied> findByProjektId(UUID projektId);

	List<Projektmitglied> findByUserId(UUID userId);
}
