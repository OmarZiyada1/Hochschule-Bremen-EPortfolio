package de.hsbremen.eportfolio.portfolio;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Datenbankzugriff auf Portfolios.
 */
public interface PortfolioRepository extends JpaRepository<Portfolio, UUID> {

	Optional<Portfolio> findByUserId(UUID userId);

	/**
	 * Die Profilbilder mehrerer Personen in einer einzigen Abfrage.
	 *
	 * <p>Gebraucht fuer die Projektkacheln: dort steht neben dem Namen der
	 * Autor:in ihr Bild, und das haengt am Portfolio und nicht am
	 * {@code User} (§3.2). Ohne Sammelabfrage entstuende je Kachel eine
	 * eigene, also genau das N+1-Problem, das der Lesedienst fuer Tags und
	 * Reaktionen bereits vermeidet.
	 *
	 * <p>Zeilen ohne hinterlegtes Bild bleiben aussen vor: sie wuerden nur
	 * einen Null-Eintrag in die Zuordnung tragen, und ein fehlender
	 * Schluessel bedeutet ohnehin dasselbe.
	 *
	 * @param userIds Konten, deren Bild gebraucht wird; darf nicht leer sein
	 */
	@Query("select new de.hsbremen.eportfolio.portfolio.PortfolioAvatar(p.user.id, p.avatarUrl) "
			+ "from Portfolio p where p.user.id in :userIds and p.avatarUrl is not null")
	List<PortfolioAvatar> findAvatarsByUserIds(@Param("userIds") Collection<UUID> userIds);
}
