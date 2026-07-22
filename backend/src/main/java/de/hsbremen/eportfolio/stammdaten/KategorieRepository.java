package de.hsbremen.eportfolio.stammdaten;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Kategorien.
 */
public interface KategorieRepository extends JpaRepository<Kategorie, UUID> {
}
