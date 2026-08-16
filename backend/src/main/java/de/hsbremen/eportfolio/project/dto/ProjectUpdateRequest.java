package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Body von {@code PUT /api/projects/{id}} (§6.1). Aendert
 * <strong>ausschliesslich Metadaten</strong>; der Inhalt laeuft ueber
 * {@code PUT /projects/{id}/blocks} (KAN-18).
 *
 * <p><strong>Warum getrennt:</strong> der Editor speichert automatisch und
 * ruft dabei nur den Block-Pfad auf. Eine gemeinsame Ressource wuerde bei jedem
 * Tastenanschlag auch die Metadaten mitschreiben und Aenderungen an ihnen
 * ueberschreiben (§6.1).
 *
 * <p><strong>Ersetzende Semantik bei den Einzelfeldern.</strong> Ein Feld, das
 * fehlt oder {@code null} ist, wird auf {@code null} gesetzt. Der Client
 * schickt also das zurueck, was er aus {@code GET /projects/{id}} bekommen hat.
 * Der Grund: bei einem Einzelfeld ist {@code null} der einzige Weg zu sagen
 * „dieser Wert soll weg". Wuerde {@code null} „unveraendert" bedeuten, liesse
 * sich eine einmal gesetzte Kategorie nie wieder entfernen, ohne einen
 * Sonderwert zu erfinden.
 *
 * <p><strong>Bei den beiden Sammlungen gilt das nicht:</strong> {@code tags},
 * {@code editorIds} und {@code members} bleiben unveraendert, wenn sie fehlen
 * oder {@code null} sind, und werden mit der leeren Liste {@code []} geleert.
 * Hier steht mit {@code []} bereits ein eigener Ausdruck fuer „leer" zur
 * Verfuegung, {@code null} ist also frei fuer „nicht anfassen". Das ist mehr als
 * Bequemlichkeit: {@code editorIds} darf nur die Autor:in und nur im Entwurf
 * aendern (§5, Fussnote ³). Bei ersetzender Semantik bekaeme ein Projektmitglied
 * schon dann <strong>403</strong>, wenn es nur den Titel korrigiert und das Feld
 * weglaesst.
 *
 * @param version        Stand aus {@code GET /projects/{id}}. Weicht er vom
 *                       Stand in der Datenbank ab, folgt <strong>409</strong>
 *                       {@code PROJECT_VERSION_CONFLICT} (§6.4)
 * @param title          Titel; Pflicht, auch beim Aendern (§3.3)
 * @param summary        Teaser
 * @param coverImageUrl  Kachelbild
 * @param projectType    (§2.6)
 * @param degree         (§2.7)
 * @param semesterId     ID eines aktiven Semesters (§3.18); null loescht sie
 * @param categoryId     (§3.6)
 * @param facultyId      (§3.8)
 * @param studyProgramId (§3.7)
 * @param moduleId       (§3.9)
 * @param tags           freie Schlagwoerter, hoechstens fuenf; {@code null}
 *                       laesst sie unveraendert
 * @param editorIds      zustaendige Redaktion; {@code null} laesst sie
 *                       unveraendert. Eine Aenderung darf nur die Autor:in und
 *                       nur im Status {@code DRAFT} (§5, Fussnote ³)
 * @param members        Co-Autor:innen und Mitwirkende (§3.13.1); {@code null}
 *                       laesst sie unveraendert
 */
public record ProjectUpdateRequest(
		@Schema(description = "Stand fuer Optimistic Locking, unveraendert aus "
				+ "GET /api/projects/{id} uebernommen (§6.4).", example = "3")
		@NotNull(message = "version fehlt. Sie gehoert in den Body jedes schreibenden Requests "
				+ "(§6.4).")
		Long version,

		@Schema(description = "Titel des Projekts.",
				example = "Barrierefreie Navigation im Hochschulportal")
		@NotBlank(message = "Titel fehlt.")
		@Size(max = 255, message = "Titel ist zu lang (hoechstens 255 Zeichen).")
		String title,

		@Schema(description = "Teaser fuer Kachel- und Listenansicht. Null loescht den Wert.",
				nullable = true)
		@Size(max = 1024, message = "Kurzbeschreibung ist zu lang (hoechstens 1024 Zeichen).")
		String summary,

		@Schema(description = "Kachelbild. Null loescht den Wert.", nullable = true)
		@Size(max = 1024, message = "coverImageUrl ist zu lang (hoechstens 1024 Zeichen).")
		String coverImageUrl,

		@Schema(description = "Null loescht den Wert (§3.3).", nullable = true)
		ProjectType projectType,

		@Schema(description = "Null loescht den Wert (§3.3).", nullable = true)
		Degree degree,

		@Schema(description = "ID eines Semesters aus GET /api/semesters. Null loescht die "
				+ "Zuordnung; nur aktive Semester sind waehlbar (§3.18).", nullable = true)
		UUID semesterId,

		@Schema(description = "ID einer Kategorie. Null loescht die Zuordnung.", nullable = true)
		UUID categoryId,

		@Schema(description = "ID einer Fakultaet. Null loescht die Zuordnung.", nullable = true)
		UUID facultyId,

		@Schema(description = "ID eines Studiengangs. Null loescht die Zuordnung.", nullable = true)
		UUID studyProgramId,

		@Schema(description = "ID eines Moduls. Null loescht die Zuordnung.", nullable = true)
		UUID moduleId,

		@Schema(description = "Freie Schlagwoerter, hoechstens fuenf. Null laesst die "
				+ "vorhandenen unveraendert, [] loescht sie.", nullable = true)
		@Size(max = 5, message = "Hoechstens fuenf Tags je Projekt.")
		Set<
				@NotBlank(message = "Ein Tag darf nicht leer sein.")
				@Size(max = 64, message = "Ein Tag ist zu lang (hoechstens 64 Zeichen).")
				String> tags,

		@Schema(description = "IDs der zustaendigen Redakteur:innen. Null laesst die Zuweisung "
				+ "unveraendert, [] hebt sie auf. Eine Aenderung ist nur der Autor:in und nur im "
				+ "Status DRAFT erlaubt, sonst 403 (§5, Fussnote 3).", nullable = true)
		Set<UUID> editorIds,

		@Schema(description = "Co-Autor:innen und Mitwirkende (§3.13). Null laesst die Liste "
				+ "unveraendert, [] leert sie. Die Autor:in gehoert nicht hinein.",
				nullable = true)
		@Valid
		List<MemberRequest> members) implements ProjectMetadataRequest {
}
