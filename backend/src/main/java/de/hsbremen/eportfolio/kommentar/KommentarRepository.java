package de.hsbremen.eportfolio.kommentar;

import de.hsbremen.eportfolio.common.enums.KommentarTyp;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Kommentare.
 */
public interface KommentarRepository extends JpaRepository<Kommentar, UUID> {

	List<Kommentar> findByProjektId(UUID projektId);

	List<Kommentar> findByProjektIdAndTyp(UUID projektId, KommentarTyp typ);
}
