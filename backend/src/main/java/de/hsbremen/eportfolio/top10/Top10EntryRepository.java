package de.hsbremen.eportfolio.top10;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf die Top-10-Liste.
 */
public interface Top10EntryRepository extends JpaRepository<Top10Entry, UUID> {

	List<Top10Entry> findAllByOrderByPositionAsc();

	Optional<Top10Entry> findByProjectId(UUID projectId);
}
