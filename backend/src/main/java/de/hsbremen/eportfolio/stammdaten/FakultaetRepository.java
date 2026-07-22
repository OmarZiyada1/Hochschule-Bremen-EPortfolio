package de.hsbremen.eportfolio.stammdaten;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Fakultaeten.
 */
public interface FakultaetRepository extends JpaRepository<Fakultaet, UUID> {
}
