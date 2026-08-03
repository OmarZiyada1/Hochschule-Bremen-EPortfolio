package de.hsbremen.eportfolio.reaction;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Datenbankzugriff auf Reaktionen.
 */
public interface ReactionRepository extends JpaRepository<Reaction, UUID> {

	Optional<Reaction> findByProjectIdAndUserId(UUID projectId, UUID userId);

	long countByProjectId(UUID projectId);

	/**
	 * Zaehlt die Reaktionen mehrerer Projekte in einer einzigen Abfrage, fuer
	 * die Kachelliste aus §6.1.
	 *
	 * <p>Projekte ohne Reaktion tauchen im Ergebnis nicht auf, weil
	 * {@code group by} nur ueber vorhandene Zeilen laeuft. Der Aufrufer setzt
	 * fuer sie 0 ein; ein {@code left join} vom Projekt aus wuerde dieselbe
	 * Information mit mehr Aufwand liefern.
	 *
	 * @param projectIds die Projekte einer Seite; leere Sammlung ergibt eine
	 *                   leere Liste
	 */
	@Query("select new de.hsbremen.eportfolio.reaction.ReactionCount(r.project.id, count(r)) "
			+ "from Reaction r where r.project.id in :projectIds group by r.project.id")
	List<ReactionCount> countPerProject(@Param("projectIds") Collection<UUID> projectIds);
}
