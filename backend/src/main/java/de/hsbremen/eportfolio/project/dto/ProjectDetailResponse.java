package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.project.Project;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Ein Projekt in der Detailansicht von {@code GET /api/projects/{id}} (§6.1).
 *
 * <p>Enthaelt gegenueber {@link ProjectCardResponse} zusaetzlich das Modul, die
 * Projektmitglieder, den geordneten Inhalt, {@code version} sowie die
 * Audit-Zeitstempel.
 *
 * <p><strong>Zwei Felder haengen an einer Sichtbarkeitspruefung:</strong>
 * {@code editors} und {@code statusHistory} sind nur fuer die Projektseite, die
 * zugewiesene Redaktion und Admins gefuellt (§5 Fussnote ⁷, §3.12). Fuer alle
 * anderen stehen sie auf {@code null}, und zwar bewusst auf {@code null} und
 * nicht auf die leere Liste: das Frontend soll „darf ich nicht sehen" von „es
 * gibt keine" unterscheiden koennen. Eine leere Liste in beiden Faellen wuerde
 * etwa suggerieren, ein Projekt habe keine Redaktion, obwohl es eine hat.
 *
 * @param id            ID des Projekts
 * @param title         Titel; Metadatum, kein Inhaltsblock (§3.3)
 * @param summary       Teaser
 * @param coverImageUrl Kachelbild
 * @param status        aktueller Status (§2.2)
 * @param projectType   (§2.6)
 * @param degree        (§2.7)
 * @param semester      z. B. „WS 2025/26"
 * @param category      (§3.6)
 * @param faculty       (§3.8)
 * @param studyProgram  (§3.7)
 * @param module        (§3.9)
 * @param author        Ersteller:in und Eigentuemer:in
 * @param members       Co-Autor:innen und Mitwirkende (§3.13)
 * @param tags          freie Schlagwoerter, hoechstens fuenf
 * @param blocks        Inhalt, nach {@code orderIndex} geordnet (§3.4)
 * @param reactionCount {@code COUNT} der Reaktionen (§3.10)
 * @param editors       zugewiesene Redaktion; {@code null}, wenn die anfragende
 *                      Person sie nicht sehen darf
 * @param statusHistory Aktivitaetsverlauf; {@code null}, wenn die anfragende
 *                      Person ihn nicht sehen darf
 * @param version       Stand fuer Optimistic Locking; gehoert bei jedem
 *                      schreibenden Request in den Body (§6.4)
 * @param publishedAt   gesetzt beim Uebergang nach {@code PUBLISHED}
 * @param createdAt     Anlagezeitpunkt
 * @param updatedAt     letzte Aenderung
 */
public record ProjectDetailResponse(
		UUID id,

		String title,

		@Schema(description = "Teaser fuer Kachel- und Listenansicht. Kann fehlen.", nullable = true)
		String summary,

		@Schema(description = "Kachelbild. Kann fehlen.", nullable = true)
		String coverImageUrl,

		ProjectStatus status,

		@Schema(description = "Im DRAFT noch nicht gesetzt; Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		ProjectType projectType,

		@Schema(description = "Im DRAFT noch nicht gesetzt; Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		Degree degree,

		@Schema(description = "Semester der Entstehung, z. B. \"WS 2025/26\".",
				example = "WS 2025/26", nullable = true)
		String semester,

		ReferenceResponse category,

		ReferenceResponse faculty,

		ReferenceResponse studyProgram,

		ReferenceResponse module,

		PersonResponse author,

		@Schema(description = "Co-Autor:innen und Mitwirkende (§3.13). Nicht zu verwechseln "
				+ "mit der zugewiesenen Redaktion.")
		List<MemberResponse> members,

		@Schema(description = "Freie Schlagwoerter, hoechstens fuenf. Alphabetisch sortiert, "
				+ "damit die Reihenfolge zwischen zwei Aufrufen stabil bleibt.")
		List<String> tags,

		@Schema(description = "Inhalt des Projekts, nach orderIndex aufsteigend geordnet. "
				+ "Ein frischer DRAFT hat keine Bloecke.")
		List<BlockResponse> blocks,

		@Schema(description = "Zahl der Reaktionen auf dieses Projekt (§3.10).", example = "12")
		long reactionCount,

		@Schema(description = "Zugewiesene Redakteur:innen (§3.3). Null, wenn die anfragende "
				+ "Person sie nicht sehen darf (§5, Fussnote 7); eine leere Liste bedeutet "
				+ "dagegen, dass keine Redaktion zugewiesen ist.", nullable = true)
		List<PersonResponse> editors,

		@Schema(description = "Aktivitaetsverlauf, aufsteigend nach Zeitpunkt (§3.12). Null, "
				+ "wenn die anfragende Person ihn nicht sehen darf (§5, Fussnote 7).",
				nullable = true)
		List<StatusHistoryResponse> statusHistory,

		@Schema(description = "Stand fuer Optimistic Locking. Gehoert unveraendert in den Body "
				+ "jedes schreibenden Requests (§6.4).", example = "3")
		Long version,

		@Schema(description = "Zeitpunkt der Veroeffentlichung. Null, solange das Projekt "
				+ "nicht veroeffentlicht ist.", nullable = true)
		Instant publishedAt,

		Instant createdAt,

		Instant updatedAt) {

	/**
	 * Baut die Detailantwort.
	 *
	 * <p>Alle Sammlungen kommen von aussen, weil der Lesedienst sie mit
	 * geladenen Bezuegen holt (Mitglieder mit ihrem Konto, Historie mit der
	 * aendernden Person) und weil ueber {@code editors} und
	 * {@code statusHistory} zuvor eine Berechtigungsentscheidung faellt. Ein
	 * Record, das sich diese Daten selbst vom Projekt zieht, koennte sie nicht
	 * treffen.
	 *
	 * @param project       Projekt mit geladenen Bezuegen
	 * @param tags          Schlagwoerter, sortiert
	 * @param reactionCount Zahl der Reaktionen
	 * @param members       Projektmitglieder (§3.13)
	 * @param blocks        Inhalt, nach {@code orderIndex} geordnet
	 * @param editors       zugewiesene Redaktion oder {@code null}, wenn sie
	 *                      nicht sichtbar ist
	 * @param statusHistory Verlauf oder {@code null}, wenn er nicht sichtbar ist
	 */
	public static ProjectDetailResponse from(
			Project project,
			List<String> tags,
			long reactionCount,
			List<MemberResponse> members,
			List<BlockResponse> blocks,
			List<PersonResponse> editors,
			List<StatusHistoryResponse> statusHistory) {

		return new ProjectDetailResponse(
				project.getId(),
				project.getTitle(),
				project.getSummary(),
				project.getCoverImageUrl(),
				project.getStatus(),
				project.getProjectType(),
				project.getDegree(),
				project.getSemester(),
				ReferenceResponse.from(project.getCategory()),
				ReferenceResponse.from(project.getFaculty()),
				ReferenceResponse.from(project.getStudyProgram()),
				ReferenceResponse.from(project.getModule()),
				PersonResponse.from(project.getAuthor()),
				members,
				tags,
				blocks,
				reactionCount,
				editors,
				statusHistory,
				project.getVersion(),
				project.getPublishedAt(),
				project.getCreatedAt(),
				project.getUpdatedAt());
	}
}
