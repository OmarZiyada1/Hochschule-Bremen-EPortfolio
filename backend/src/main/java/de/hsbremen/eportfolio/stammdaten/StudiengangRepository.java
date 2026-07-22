package de.hsbremen.eportfolio.stammdaten;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Studiengaenge.
 */
public interface StudiengangRepository extends JpaRepository<Studiengang, UUID> {

	List<Studiengang> findByFakultaetId(UUID fakultaetId);
}
