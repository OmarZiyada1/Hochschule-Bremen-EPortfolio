package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Body von {@code POST /api/projects} (§6.1). Ergebnis ist ein Projekt im Status
 * {@code DRAFT} (§4.1, Zeile „Anlegen").
 *
 * <p><strong>Nur der Titel ist Pflicht.</strong> Alle uebrigen Metadaten duerfen
 * im Entwurf {@code null} sein und werden erst beim Einreichen verlangt (§3.3,
 * Hinweis „Pflichtfelder beim Einreichen"; geprueft in KAN-19). Der Grund steht
 * dort: ein Entwurf ist ein Arbeitszustand, und Vollstaendigkeit schon beim
 * ersten Speichern zu fordern hiesse, dass niemand mit dem Schreiben anfangen
 * kann, bevor alle Rahmendaten feststehen.
 *
 * <p>Die Autor:in wird nicht mitgeschickt, sondern ist die angemeldete Person
 * (§3.3). Ein Feld dafuer waere eine Einladung, fremde Projekte anzulegen.
 *
 * @param title          Titel; Pflicht, Metadatum und kein Inhaltsblock (§3.3)
 * @param summary        Teaser fuer Kachel- und Listenansicht
 * @param coverImageUrl  Kachelbild
 * @param projectType    (§2.6)
 * @param degree         (§2.7)
 * @param semesterId     ID eines aktiven Semesters (§3.18)
 * @param categoryId     (§3.6)
 * @param facultyId      (§3.8)
 * @param studyProgramId (§3.7)
 * @param moduleId       (§3.9)
 * @param tags           freie Schlagwoerter, hoechstens fuenf (§3.3)
 * @param editorIds      zustaendige Redaktion; die Autor:in legt sie hier fest
 *                       (§5, Fussnote ³)
 * @param members        Co-Autor:innen und Mitwirkende (§3.13.1)
 */
public record ProjectCreateRequest(
		@Schema(description = "Titel des Projekts. Einziges Pflichtfeld beim Anlegen.",
				example = "Barrierefreie Navigation im Hochschulportal")
		@NotBlank(message = "Titel fehlt.")
		@Size(max = 255, message = "Titel ist zu lang (hoechstens 255 Zeichen).")
		String title,

		@Schema(description = "Teaser fuer Kachel- und Listenansicht.", nullable = true)
		@Size(max = 1024, message = "Kurzbeschreibung ist zu lang (hoechstens 1024 Zeichen).")
		String summary,

		@Schema(description = "Funktionsbezeichnung der Autor:in im Projekt, z. B. "
				+ "\"Konzept\". Freiwillig; die Autor:in bleibt Autor:in und wird kein "
				+ "Mitglied (§3.13.1).", example = "Konzept")
		@Size(max = 255, message = "authorRole ist zu lang (hoechstens 255 Zeichen).")
		String authorRole,

		@Schema(description = "Kachelbild.", nullable = true)
		@Size(max = 1024, message = "coverImageUrl ist zu lang (hoechstens 1024 Zeichen).")
		String coverImageUrl,

		@Schema(description = "Im Entwurf noch nicht noetig, Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		ProjectType projectType,

		@Schema(description = "Im Entwurf noch nicht noetig, Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		Degree degree,

		@Schema(description = "ID eines Semesters aus GET /api/semesters. Nur aktive Semester "
				+ "sind waehlbar (§3.18).", nullable = true)
		UUID semesterId,

		@Schema(description = "ID einer Kategorie aus GET /api/categories.", nullable = true)
		UUID categoryId,

		@Schema(description = "ID einer Fakultaet aus GET /api/faculties.", nullable = true)
		UUID facultyId,

		@Schema(description = "ID eines Studiengangs aus GET /api/study-programs.", nullable = true)
		UUID studyProgramId,

		@Schema(description = "ID eines Moduls aus GET /api/modules.", nullable = true)
		UUID moduleId,

		@Schema(description = "Freie Schlagwoerter, hoechstens fuenf (§3.3). Doppelte Eintraege "
				+ "werden still zusammengefasst.")
		@Size(max = 5, message = "Hoechstens fuenf Tags je Projekt.")
		Set<
				@NotBlank(message = "Ein Tag darf nicht leer sein.")
				@Size(max = 64, message = "Ein Tag ist zu lang (hoechstens 64 Zeichen).")
				String> tags,

		@Schema(description = "IDs der zustaendigen Redakteur:innen aus "
				+ "GET /api/users/lookup?role=EDITOR&role=ADMIN; beide Rollen sind "
				+ "zuweisbar (§5, Fussnote 5 seit Contract v89). "
				+ "Die Autor:in legt sie bei der Anlage fest "
				+ "und kann sie aendern, solange das Projekt in DRAFT oder REVISION steht "
				+ "(seit Contract v62), unabhaengig von "
				+ "ihrer eigenen Systemrolle (§5, Fussnote 3). Nicht eintragen laesst sich, wer "
				+ "zur Projektseite gehoert: weder die anfragende Person selbst noch die Autor:in "
				+ "noch jemand aus members, sonst 400 VALIDATION_FAILED.")
		Set<UUID> editorIds,

		@Schema(description = "Co-Autor:innen und Mitwirkende (§3.13). Nicht zu verwechseln mit "
				+ "der zugewiesenen Redaktion. Die Autor:in selbst gehoert nicht in diese Liste, "
				+ "und wer in editorIds steht, ebenso wenig (§5, Fussnote 3).")
		@Valid
		List<MemberRequest> members) implements ProjectMetadataRequest {
}
