package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.enums.NominationStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Top-10-Nominierungen.
 */
public interface Top10NominationRepository extends JpaRepository<Top10Nomination, UUID> {

	List<Top10Nomination> findByStatus(NominationStatus status);

	List<Top10Nomination> findByProjectId(UUID projectId);
}
