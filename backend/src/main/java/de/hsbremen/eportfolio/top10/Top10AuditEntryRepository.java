package de.hsbremen.eportfolio.top10;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

/**
 * Datenbankzugriff auf das Aenderungsprotokoll der Top-10 (§3.17).
 *
 * <p><strong>Es gibt keine Loesch- und keine Aendermethode</strong>, und das ist
 * die Umsetzung der Zusage aus §3.17. Die geerbten Schreibmethoden von
 * {@code JpaRepository} bleiben unvermeidbar, aber gerufen wird ausschliesslich
 * {@code saveAll} aus {@code Top10AuditService.record}; die Setter der Entity
 * sind paketprivat, ausserhalb von {@code top10} kann also niemand eine Zeile
 * bauen oder umschreiben.
 *
 * <p>{@code JpaSpecificationExecutor} kommt wegen der drei optionalen Filter aus
 * §6.1 dazu ({@code from}, {@code to}, {@code admin}); die Bausteine stehen in
 * {@link Top10AuditSpecifications}.
 */
public interface Top10AuditEntryRepository extends JpaRepository<Top10AuditEntry, UUID>,
		JpaSpecificationExecutor<Top10AuditEntry> {

	/**
	 * Gefilterte, sortierte und paginierte Protokollseite.
	 *
	 * <p>Ueberschrieben nur, um den {@code @EntityGraph} anzuhaengen: die Antwort
	 * zeigt je Zeile den Namen der handelnden Person und den Titel des Projekts
	 * (KAN-40). Ohne ihn laedt Hibernate beide je Zeile einzeln nach, bei zwanzig
	 * Zeilen also bis zu vierzig zusaetzliche Abfragen. Beide Beziehungen sind
	 * {@code @ManyToOne} und lassen sich deshalb gefahrlos mitziehen, ohne dass
	 * die Paginierung in den Arbeitsspeicher wandert.
	 */
	@Override
	@EntityGraph(attributePaths = {"admin", "project"})
	Page<Top10AuditEntry> findAll(Specification<Top10AuditEntry> specification, Pageable pageable);
}
