package de.hsbremen.eportfolio.reaktion;

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
public interface ReaktionRepository extends JpaRepository<Reaktion, UUID> {

	Optional<Reaktion> findByProjektIdAndUserId(UUID projektId, UUID userId);

	long countByProjektId(UUID projektId);

	/**
	 * Zaehlt die Reaktionen mehrerer Projekte in einer einzigen Abfrage, fuer
	 * die Kachelliste aus §6.1.
	 *
	 * <p>Projekte ohne Reaktion tauchen im Ergebnis nicht auf, weil
	 * {@code group by} nur ueber vorhandene Zeilen laeuft. Der Aufrufer setzt
	 * fuer sie 0 ein; ein {@code left join} vom Projekt aus wuerde dieselbe
	 * Information mit mehr Aufwand liefern.
	 *
	 * @param projektIds die Projekte einer Seite; leere Sammlung ergibt eine
	 *                   leere Liste
	 */
	@Query("select new de.hsbremen.eportfolio.reaktion.ReaktionAnzahl(r.projekt.id, count(r)) "
			+ "from Reaktion r where r.projekt.id in :projektIds group by r.projekt.id")
	List<ReaktionAnzahl> zaehleJeProjekt(@Param("projektIds") Collection<UUID> projektIds);
}
