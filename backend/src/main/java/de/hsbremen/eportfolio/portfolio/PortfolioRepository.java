package de.hsbremen.eportfolio.portfolio;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Portfolios.
 */
public interface PortfolioRepository extends JpaRepository<Portfolio, UUID> {

	Optional<Portfolio> findByUserId(UUID userId);
}
