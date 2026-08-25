package de.hsbremen.eportfolio.project;

import java.util.Collection;
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

	/**
	 * Die Mitglieder mehrerer Projekte in einer einzigen Abfrage, fuer die
	 * Kachelliste (§3.13, seit Contract v78).
	 *
	 * <p>Dieselbe Ueberlegung wie bei {@code PortfolioRepository.findAvatarsByUserIds}:
	 * die Mitglieder je Kachel nachzuladen waere genau das N+1-Verhalten, das der
	 * Lesedienst fuer Tags, Reaktionen und Profilbilder bereits vermeidet. Eine
	 * Seite kostet damit eine Abfrage mehr, unabhaengig von ihrer Groesse.
	 *
	 * <p>{@code project} steht neben {@code user} im Graph, obwohl die Antwort das
	 * Projekt nicht zeigt. Der Aufrufer muss die Zeilen ihren Projekten zuordnen
	 * und liest dafuer {@code member.getProject().getId()}. Ohne den Graph waere
	 * das im unguenstigen Fall ein Lazy-Proxy, dessen Initialisierung je Mitglied
	 * eine eigene Abfrage kostet, also das N+1 durch die Hintertuer.
	 *
	 * @param projectIds Projekte der Seite; darf nicht leer sein
	 */
	@EntityGraph(attributePaths = {"user", "project"})
	List<ProjectMember> findByProjectIdIn(Collection<UUID> projectIds);

	List<ProjectMember> findByUserId(UUID userId);
}
