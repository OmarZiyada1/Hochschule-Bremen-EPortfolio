package de.hsbremen.eportfolio.project;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf die Statushistorie von Projekten.
 */
public interface ProjectStatusHistoryRepository extends JpaRepository<ProjectStatusHistory, UUID> {

	/**
	 * Der Aktivitaetsverlauf eines Projekts, aeltester Eintrag zuerst (§3.12).
	 *
	 * <p>Der {@code @EntityGraph} zieht die aendernde Person mit, weil der
	 * Verlauf sie namentlich anzeigt. Ohne ihn kostet jeder Eintrag eine eigene
	 * Abfrage, und gerade ein oft zurueckgewiesenes Projekt hat viele Eintraege.
	 */
	@EntityGraph(attributePaths = "changedBy")
	List<ProjectStatusHistory> findByProjectIdOrderByTimestampAsc(UUID projectId);
}
