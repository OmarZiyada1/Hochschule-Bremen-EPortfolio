package de.hsbremen.eportfolio.project;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Datenbankzugriff auf Projektmitglieder.
 */
public interface ProjectMemberRepository extends JpaRepository<ProjectMember, UUID> {

	/**
	 * Mitglieder eines Projekts samt ihrem Konto.
	 *
	 * <p>Der {@code @EntityGraph} zieht {@code user} mit, weil die Antwort aus
	 * §6.1 Vor- und Nachnamen enthaelt. Ohne ihn faellt je Mitglied eine eigene
	 * Abfrage an, und das ausgerechnet bei Gruppenarbeiten mit vielen
	 * Beteiligten.
	 */
	@EntityGraph(attributePaths = "user")
	List<ProjectMember> findByProjectId(UUID projectId);

	List<ProjectMember> findByUserId(UUID userId);
}
