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
 * Ein Projekt in der Listenansicht von {@code GET /api/projects} (§6.1).
 *
 * <p>Die Kachel traegt genau das, was Uebersicht und Filterleiste anzeigen.
 * Seit Contract v68 traegt sie auch {@code module} (§3.9): die Redaktionsliste
 * „Meine Reviews" zeigt eine Spalte „Fach", und ein Nachladen je Zeile waere
 * genau das N+1, das der Lesedienst sonst ueberall vermeidet.
 *
 * <p>Seit Contract v78 traegt sie ausserdem {@code members} (§3.13). Bis dahin
 * kannte die Kachel nur die Autor:in, und eine Gruppenarbeit erschien damit
 * ueberall unter einem einzigen Namen, obwohl mehrere Personen daran gearbeitet
 * haben. Geladen wird die Liste wie die Profilbilder je Seite und nicht je
 * Kachel.
 *
 * <p><strong>Warum {@code members} und nicht {@code editors}.</strong> Die
 * Mitgliederliste gehoert zum Projekt selbst: wer das Projekt sehen darf, darf
 * auch wissen, wer daran gearbeitet hat. Die zugewiesene Redaktion unterliegt
 * dagegen einer Sichtbarkeitspruefung nach §5 (Fussnote 7): vor der
 * Veroeffentlichung sehen sie nur die Projektseite, die zugewiesene Redaktion
 * und der Admin. Diese Pruefung haengt an Rolle und Status und waere damit je
 * Kachel zu treffen. Die Redaktion bleibt deshalb
 * {@link ProjectDetailResponse} vorbehalten, wo sie genau einmal geprueft wird.
 *
 * <p>Nicht enthalten sind ausserdem {@code blocks}, die Statushistorie und
 * {@code version}: das Blockdokument je Treffer zu laden waere fuer eine Liste
 * unverhaeltnismaessig, und die uebrigen Felder unterliegen derselben
 * Sichtbarkeitspruefung wie {@code editors}. Wer sie braucht, holt sich
 * {@link ProjectDetailResponse}.
 *
 * @param id              ID des Projekts
 * @param title           Titel; Metadatum, kein Inhaltsblock (§3.3)
 * @param summary         Teaser fuer die Kachel
 * @param coverImageUrl   Kachelbild
 * @param status          aktueller Status (§2.2)
 * @param projectType     (§2.6)
 * @param degree          (§2.7)
 * @param semester        Semester der Entstehung (§3.18)
 * @param category        (§3.6)
 * @param faculty         (§3.8)
 * @param studyProgram    (§3.7)
 * @param module          (§3.9)
 * @param author          Ersteller:in und Eigentuemer:in
 * @param members         weitere Beteiligte (§3.13), ohne die Autor:in
 * @param tags            freie Schlagwoerter, hoechstens fuenf
 * @param reactionCount   {@code COUNT} der Reaktionen (§3.10)
 * @param publishedAt     gesetzt beim Uebergang nach {@code PUBLISHED}
 */
public record ProjectCardResponse(
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

		@Schema(description = "Modul, im Prototyp als \"Fach\" beschriftet (§3.9). Seit "
				+ "Contract v68 an der Kachel, weil \"Meine Reviews\" eine Spalte dafuer "
				+ "fuehrt. Kann fehlen; es ist kein Pflichtfeld des Einreichens (§3.3).",
				nullable = true)
		ReferenceResponse module,

		PersonResponse author,

		@Schema(description = "Weitere Beteiligte des Projekts (§3.13), seit Contract v78 an "
				+ "der Kachel: eine Gruppenarbeit stand sonst ueberall unter einem einzigen "
				+ "Namen. Die Autor:in ist kein Mitglied und steht in \"author\" (§3.13.1). "
				+ "Nach Nachname und Vorname geordnet, damit die Reihenfolge zwischen zwei "
				+ "Aufrufen stabil bleibt. Leer bei einer Einzelarbeit.")
		List<MemberResponse> members,

		@Schema(description = "Freie Schlagwoerter, hoechstens fuenf. Alphabetisch sortiert, "
				+ "damit die Reihenfolge zwischen zwei Aufrufen stabil bleibt.")
		List<String> tags,

		@Schema(description = "Zahl der Reaktionen auf dieses Projekt (§3.10).", example = "12")
		long reactionCount,

		@Schema(description = "Zeitpunkt der Veroeffentlichung. Null, solange das Projekt "
				+ "nicht veroeffentlicht ist.", nullable = true)
		Instant publishedAt) {

	/**
	 * Baut die Kachel.
	 *
	 * <p>{@code tags} und {@code reactionCount} kommen von aussen und werden
	 * nicht am Projekt nachgeladen: der Lesedienst holt beides fuer die ganze
	 * Seite in je einer Abfrage. Wuerde dieses Record sie selbst vom Projekt
	 * ziehen, entstuenden pro Kachel zwei zusaetzliche Abfragen und damit genau
	 * das N+1-Problem, das der Ticket-Hinweis meint. Fuer {@code members} und
	 * die Profilbilder gilt seit Contract v78 dasselbe.
	 *
	 * @param project           Projekt mit bereits geladenen Bezuegen (Autor,
	 *                          Kategorie, Fakultaet, Studiengang)
	 * @param tags              Schlagwoerter dieses Projekts, sortiert
	 * @param reactionCount     Zahl der Reaktionen
	 * @param authorAvatarUrl   Profilbild der Autor:in, {@code null} wenn keines
	 *                          hinterlegt ist. Kommt wie Tags und Reaktionen von
	 *                          aussen: es haengt am Portfolio und nicht am
	 *                          Projekt (§3.2), und der Lesedienst holt es fuer
	 *                          die ganze Seite in einer Abfrage
	 * @param members           Mitglieder dieses Projekts (§3.13), bereits
	 *                          geordnet und mit ihren Profilbildern versehen;
	 *                          leer bei einer Einzelarbeit
	 */
	public static ProjectCardResponse from(Project project, List<String> tags, long reactionCount,
			String authorAvatarUrl, List<MemberResponse> members) {

		return new ProjectCardResponse(
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
				PersonResponse.from(project.getAuthor(), authorAvatarUrl),
				members,
				tags,
				reactionCount,
				project.getPublishedAt());
	}
}
