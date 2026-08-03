package de.hsbremen.eportfolio.project;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Inhaltsbloecke.
 */
public interface BlockRepository extends JpaRepository<Block, UUID> {

	List<Block> findByProjectIdOrderByOrderIndexAsc(UUID projectId);

	void deleteByProjectId(UUID projectId);
}
