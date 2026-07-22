package de.hsbremen.eportfolio.reaktion;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Reaktionen.
 */
public interface ReaktionRepository extends JpaRepository<Reaktion, UUID> {

	Optional<Reaktion> findByProjektIdAndUserId(UUID projektId, UUID userId);

	long countByProjektId(UUID projektId);
}
