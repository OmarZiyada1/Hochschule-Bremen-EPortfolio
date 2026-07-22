package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.common.enums.NominierungStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Top-10-Nominierungen.
 */
public interface Top10NominierungRepository extends JpaRepository<Top10Nominierung, UUID> {

	List<Top10Nominierung> findByStatus(NominierungStatus status);

	List<Top10Nominierung> findByProjektId(UUID projektId);
}
