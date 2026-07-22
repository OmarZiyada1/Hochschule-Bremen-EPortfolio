package de.hsbremen.eportfolio.projekt;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Inhaltsbloecke.
 */
public interface BlockRepository extends JpaRepository<Block, UUID> {

	List<Block> findByProjektIdOrderByReihenfolgeAsc(UUID projektId);

	void deleteByProjektId(UUID projektId);
}
