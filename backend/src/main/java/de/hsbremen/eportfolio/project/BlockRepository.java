package de.hsbremen.eportfolio.project;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Datenbankzugriff auf Inhaltsbloecke.
 */
public interface BlockRepository extends JpaRepository<Block, UUID> {

	List<Block> findByProjectIdOrderByOrderIndexAsc(UUID projectId);

	void deleteByProjectId(UUID projectId);

	/**
	 * Kennzahl {@code blocksByType} des Admin-Dashboards (§6.1), ueber alle
	 * Projekte hinweg.
	 *
	 * <p>Eine Abfrage mit {@code group by} statt vierzehn einzelner Zaehlungen,
	 * siehe {@link BlockTypeCount}.
	 */
	@Query("select new de.hsbremen.eportfolio.project.BlockTypeCount(b.type, count(b)) "
			+ "from Block b group by b.type")
	List<BlockTypeCount> countPerType();
}
