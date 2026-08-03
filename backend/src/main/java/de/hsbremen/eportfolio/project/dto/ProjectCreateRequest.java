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
 * @param semester       z. B. „WS 2025/26"
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

		@Schema(description = "Kachelbild.", nullable = true)
		@Size(max = 1024, message = "coverImageUrl ist zu lang (hoechstens 1024 Zeichen).")
		String coverImageUrl,

		@Schema(description = "Im Entwurf noch nicht noetig, Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		ProjectType projectType,

		@Schema(description = "Im Entwurf noch nicht noetig, Pflicht erst beim Einreichen (§3.3).",
				nullable = true)
		Degree degree,

		@Schema(description = "Semester der Entstehung.", example = "WS 2025/26", nullable = true)
		@Size(max = 64, message = "Semester ist zu lang (hoechstens 64 Zeichen).")
		String semester,

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
				+ "GET /api/users/lookup?role=EDITOR. Die Autor:in legt sie bei der Anlage fest "
				+ "und kann sie aendern, solange das Projekt im Status DRAFT ist (§5, Fussnote 3).")
		Set<UUID> editorIds,

		@Schema(description = "Co-Autor:innen und Mitwirkende (§3.13). Nicht zu verwechseln mit "
				+ "der zugewiesenen Redaktion. Die Autor:in selbst gehoert nicht in diese Liste.")
		@Valid
		List<MemberRequest> members) implements ProjectMetadataRequest {
}
