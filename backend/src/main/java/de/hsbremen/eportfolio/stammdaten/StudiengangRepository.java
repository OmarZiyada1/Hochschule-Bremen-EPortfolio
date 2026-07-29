package de.hsbremen.eportfolio.stammdaten;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Studiengaenge.
 *
 * <p>Die beiden Lesemethoden holen die Fakultaet per {@code @EntityGraph} mit.
 * {@code StudiengangAntwort} braucht deren ID; ohne den Fetch-Join laedt
 * Hibernate den LAZY-Proxy je Zeile einzeln nach und aus einem Endpoint werden
 * bei fuenf Fakultaeten sechs Abfragen (N+1).
 */
public interface StudiengangRepository extends JpaRepository<Studiengang, UUID> {

	/** Alle Studiengaenge nach Name aufsteigend (§6.1). */
	@EntityGraph(attributePaths = "fakultaet")
	List<Studiengang> findAllByOrderByNameAsc();

	/** Studiengaenge einer Fakultaet, nach Name aufsteigend — Filter aus §6.1. */
	@EntityGraph(attributePaths = "fakultaet")
	List<Studiengang> findByFakultaetIdOrderByNameAsc(UUID fakultaetId);

	/**
	 * Suche ueber den fachlichen Schluessel innerhalb einer Fakultaet. Die
	 * Tabelle hat darauf keinen Unique-Index; fuer den {@link DevStammdatenSeeder}
	 * ist das Paar aus Fakultaet und Name trotzdem eindeutig genug, um einen
	 * zweiten Lauf ohne Duplikate zu ueberstehen.
	 */
	Optional<Studiengang> findByFakultaetIdAndName(UUID fakultaetId, String name);
}
