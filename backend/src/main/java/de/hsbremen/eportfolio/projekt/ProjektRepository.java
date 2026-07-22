package de.hsbremen.eportfolio.projekt;

import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Datenbankzugriff auf Projekte.
 */
public interface ProjektRepository extends JpaRepository<Projekt, UUID> {

	List<Projekt> findByStatus(ProjektStatus status);

	List<Projekt> findByAutorId(UUID autorId);

	List<Projekt> findByRedakteureId(UUID redakteurId);

	/**
	 * Projekte fuer die Portfolio-Ansicht: ein Projekt zaehlt dazu, wenn die
	 * Person Autor:in oder Projektmitglied ist.
	 */
	@Query("select distinct p from Projekt p left join p.mitglieder m "
			+ "where p.autor.id = :userId or m.user.id = :userId")
	List<Projekt> findByBeteiligung(@Param("userId") UUID userId);

	/**
	 * Wie {@link #findByBeteiligung(UUID)}, zusaetzlich auf einen Status eingegrenzt.
	 */
	@Query("select distinct p from Projekt p left join p.mitglieder m "
			+ "where (p.autor.id = :userId or m.user.id = :userId) "
			+ "and p.status = :status")
	List<Projekt> findByBeteiligungAndStatus(@Param("userId") UUID userId,
			@Param("status") ProjektStatus status);
}
