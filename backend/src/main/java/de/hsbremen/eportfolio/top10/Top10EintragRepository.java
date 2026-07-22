package de.hsbremen.eportfolio.top10;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf die Top-10-Liste.
 */
public interface Top10EintragRepository extends JpaRepository<Top10Eintrag, UUID> {

	List<Top10Eintrag> findAllByOrderByPositionAsc();

	Optional<Top10Eintrag> findByProjektId(UUID projektId);
}
