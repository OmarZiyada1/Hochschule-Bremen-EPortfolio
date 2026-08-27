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
 * <p><strong>Zwei Felder haengen an einer Sichtbarkeitspruefung</strong>, seit
 * Contract v55 aber nicht mehr an derselben. {@code statusHistory} ist nur fuer
 * die Projektseite, die zugewiesene Redaktion und Admins gefuellt (§5 Fussnote ⁷,
 * §3.12). {@code editors} folgt derselben Regel, ist zusaetzlich aber fuer alle
 * sichtbar, sobald das Projekt {@code PUBLISHED} ist (§3.3): wer eine
 * veroeffentlichte Arbeit betreut hat, gehoert zu ihrer Angabe. Entschieden wird
 * beides in {@code ProjectPermissionService}.
 *
 * <p>Wer sie nicht sehen darf, bekommt {@code null}, und zwar bewusst
 * {@code null} und nicht die leere Liste: das Frontend soll „darf ich nicht
 * sehen" von „es gibt keine" unterscheiden koennen. Eine leere Liste in beiden
 * Faellen wuerde etwa suggerieren, ein Projekt habe keine Redaktion, obwohl es
 * eine hat. Das Feld wird dabei nie weggelassen, sondern steht ausdruecklich
 * auf {@code null}; ein Client, der auf „nicht vorhanden" prueft statt auf
 * {@code null}, liegt fuer jede unbeteiligte Person falsch.
 *
 * <p>Praktisch trifft das seit v55 nur noch {@code statusHistory}: wer ein
 * nicht veroeffentlichtes Projekt ueberhaupt lesen darf, sieht auch dessen
 * Redaktion, {@code editors} ist in jeder ausgelieferten Antwort also gefuellt.
 * Damit ist {@code statusHistory} zugleich das Kennzeichen, an dem ein Client
 * erkennt, dass die lesende Person die Interna sehen darf (Projektseite,
 * zugewiesene Redaktion oder Admin), ohne aus der Rolle zu raten.
 *
 * @param id            ID des Projekts
 * @param title         Titel; Metadatum, kein Inhaltsblock (§3.3)
 * @param summary       Teaser
 * @param coverImageUrl Kachelbild
 * @param status        aktueller Status (§2.2)
 * @param projectType   (§2.6)
 * @param degree        (§2.7)
 * @param semester      Semester der Entstehung (§3.18)
 * @param category      (§3.6)
 * @param faculty       (§3.8)
 * @param studyProgram  (§3.7)
 * @param module        (§3.9)
 * @param author        Ersteller:in und Eigentuemer:in
 * @param authorRole    ihre Funktionsbezeichnung im Projekt, freiwillig
 *                      (§3.3 seit Contract v66)
 * @param members       Co-Autor:innen und Mitwirkende (§3.13)
 * @param tags          freie Schlagwoerter, hoechstens fuenf
 * @param blocks        Inhalt, nach {@code orderIndex} geordnet (§3.4)
 * @param reactionCount {@code COUNT} der Reaktionen (§3.10)
 * @param hasReacted    ob die lesende Person selbst reagiert hat (§3.10, seit
 *                      Contract v84)
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

		@Schema(description = "Semester der Entstehung (§3.18). Im DRAFT noch nicht gesetzt.",
				nullable = true)
		ReferenceResponse semester,

		@Schema(description = "Kategorie (§3.6). Im DRAFT noch nicht gesetzt.",
				nullable = true)
		ReferenceResponse category,

		@Schema(description = "Fakultaet (§3.8). Im DRAFT noch nicht gesetzt.",
				nullable = true)
		ReferenceResponse faculty,

		@Schema(description = "Studiengang (§3.7). Im DRAFT noch nicht gesetzt.",
				nullable = true)
		ReferenceResponse studyProgram,

		@Schema(description = "Fach oder Modul (§3.9). Dauerhaft freiwillig: anders als "
				+ "die uebrigen Bezuege steht es nicht unter den Pflichtfeldern des "
				+ "Einreichens (§3.3).", nullable = true)
		ReferenceResponse module,

		PersonResponse author,

		@Schema(description = "Funktionsbezeichnung der Autor:in im Projekt, z. B. "
				+ "\"Konzept\" (§3.3 seit Contract v66). Freiwillig; die Autor:in bleibt "
				+ "Autor:in und ist kein Mitglied (§3.13.1).",
				example = "Konzept", nullable = true,
				requiredMode = Schema.RequiredMode.NOT_REQUIRED)
		String authorRole,

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

		@Schema(description = "Ob die lesende Person selbst bereits reagiert hat (§3.10, seit "
				+ "Contract v84). Ohne Token immer false. Die Oberflaeche zeigt daran das "
				+ "gefuellte statt des offenen Symbols; ohne dieses Feld liesse sich der "
				+ "gedrueckte Zustand nur bis zum naechsten Neuladen halten.",
				example = "false")
		boolean hasReacted,

		@Schema(description = "Zugewiesene Redakteur:innen (§3.3). Bei einem PUBLISHED-Projekt "
				+ "fuer alle sichtbar, auch ohne Anmeldung (seit Contract v55); in jedem "
				+ "anderen Status nur fuer die Projektseite, die zugewiesene Redaktion und "
				+ "Admins. In der Praxis damit immer gefuellt: wer ein nicht "
				+ "veroeffentlichtes Projekt ueberhaupt lesen darf, gehoert genau zu diesem "
				+ "Kreis. Eine leere Liste bedeutet, dass keine Redaktion zugewiesen ist.",
				nullable = true)
		List<PersonResponse> editors,

		@Schema(description = "Aktivitaetsverlauf, aufsteigend nach Zeitpunkt (§3.12). "
				+ "Ausdruecklich null, wenn die anfragende Person ihn nicht sehen darf "
				+ "(§5, Fussnote 7); das Feld fehlt nicht, es steht auf null. Damit "
				+ "zugleich das Kennzeichen, an dem ein Client erkennt, dass die lesende "
				+ "Person die Interna sehen darf, also Projektseite, zugewiesene Redaktion "
				+ "oder Admin ist, ohne aus der Rolle zu raten.",
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
	 * @param hasReacted    ob die lesende Person selbst reagiert hat (§3.10)
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
			boolean hasReacted,
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
				ReferenceResponse.from(project.getSemester()),
				ReferenceResponse.from(project.getCategory()),
				ReferenceResponse.from(project.getFaculty()),
				ReferenceResponse.from(project.getStudyProgram()),
				ReferenceResponse.from(project.getModule()),
				PersonResponse.from(project.getAuthor()),
				project.getAuthorRole(),
				members,
				tags,
				blocks,
				reactionCount,
				hasReacted,
				editors,
				statusHistory,
				project.getVersion(),
				project.getPublishedAt(),
				project.getCreatedAt(),
				project.getUpdatedAt());
	}
}
