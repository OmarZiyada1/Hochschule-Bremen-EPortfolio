package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.project.dto.ProjectCardResponse;
import de.hsbremen.eportfolio.project.dto.ProjectDetailResponse;
import de.hsbremen.eportfolio.project.dto.ProjectFilterRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die lesenden Projekt-Endpoints aus API-Contract §6.1.
 *
 * <p>Beide Pfade sind in {@code SecurityConfig} bereits als PUBLIC-GET
 * freigegeben; die Regeln standen dort schon vor diesem Controller, damit er
 * nicht versehentlich hinter {@code anyRequest().authenticated()} landet. „Frei
 * erreichbar" heisst hier ausdruecklich nicht „alles sichtbar": was ein
 * Aufrufer tatsaechlich bekommt, entscheidet der {@link ProjectReadService}
 * anhand der Rechtematrix (§5). Ohne Token ist
 * {@code @AuthenticationPrincipal} {@code null}, und genau das ist der
 * PUBLIC-Fall aus §2.1.
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen. Filterlogik,
 * Sichtbarkeit und Fehlerpolitik liegen im Service.
 */
@RestController
@RequestMapping("/api/projects")
@Tag(name = "Projekte", description = "Projektliste und Projektdetail (§6.1). Ohne Token sind "
		+ "nur veroeffentlichte Projekte sichtbar; mit Token richtet sich der Umfang nach der "
		+ "Rechtematrix aus §5.")
public class ProjectController {

	private final ProjectReadService projectReadService;

	public ProjectController(ProjectReadService projectReadService) {
		this.projectReadService = projectReadService;
	}

	/**
	 * Projektliste mit Filtern und Paginierung.
	 *
	 * <p>Die Filter werden einzeln gebunden statt als Objekt, damit jeder von
	 * ihnen in der OpenAPI-Beschreibung seine eigene Erklaerung tragen kann. Zu
	 * einem {@code ProjectFilterRequest} gebuendelt werden sie erst beim
	 * Weiterreichen.
	 */
	@Operation(summary = "Projektliste lesen",
			description = "Liefert eine Seite im Format PageResponse<ProjectCardResponse> (§6.6). "
					+ "Ohne Token kommen nur veroeffentlichte Projekte; Studierende sehen "
					+ "zusaetzlich ihre eigenen, Redaktion und Admin alle (§5). Unbekannte "
					+ "Filter-IDs ergeben eine leere Liste, kein 404.")
	@ApiResponse(responseCode = "200", description = "Eine Seite der Projektliste.")
	@ApiResponse(responseCode = "400", description = "Ein Parameter hat nicht das erwartete Format "
			+ "oder es wurde nach einem nicht erlaubten Feld sortiert.")
	@ApiResponse(responseCode = "401", description = "\"editor=me\" ohne Anmeldung, oder das "
			+ "mitgeschickte Token ist ungueltig bzw. abgelaufen.")
	@GetMapping
	public PageResponse<ProjectCardResponse> list(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "Filter: ID einer Kategorie aus GET /api/categories.")
			@RequestParam(name = "category", required = false) UUID category,

			@Parameter(description = "Filter: ID einer Fakultaet aus GET /api/faculties.")
			@RequestParam(name = "faculty", required = false) UUID faculty,

			@Parameter(description = "Filter: ID eines Studiengangs aus GET /api/study-programs.")
			@RequestParam(name = "studyProgram", required = false) UUID studyProgram,

			@Parameter(description = "Filter: ID eines Moduls aus GET /api/modules.")
			@RequestParam(name = "module", required = false) UUID module,

			@Parameter(description = "Filter: angestrebter Abschluss (§2.7).")
			@RequestParam(name = "degree", required = false) Degree degree,

			@Parameter(description = "Filter: Projekttyp (§2.6).")
			@RequestParam(name = "type", required = false) ProjectType type,

			@Parameter(description = "Filter: Semester in genau der gespeicherten Schreibweise.",
					example = "WS 2025/26")
			@RequestParam(name = "semester", required = false) String semester,

			@Parameter(description = "Suchbegriff fuer Titel und Kurzbeschreibung, unabhaengig "
					+ "von Gross- und Kleinschreibung.")
			@RequestParam(name = "q", required = false) String q,

			@Parameter(description = "Filter: Projektstatus (§2.2). Wirkt nur innerhalb dessen, "
					+ "was ohne Anmeldung ohnehin sichtbar ist.")
			@RequestParam(name = "status", required = false) ProjectStatus status,

			@Parameter(description = "Filter: ID der Autor:in.")
			@RequestParam(name = "author", required = false) UUID author,

			@Parameter(description = "Filter: ID einer zugewiesenen Redakteur:in, oder \"me\" "
					+ "fuer \"Meine Reviews\". \"me\" setzt eine Anmeldung voraus.",
					example = "me")
			@RequestParam(name = "editor", required = false) String editor,

			@ParameterObject
			@PageableDefault(size = 20, sort = "updatedAt", direction = Sort.Direction.DESC)
			Pageable pageable) {

		ProjectFilterRequest filter = new ProjectFilterRequest(
				category, faculty, studyProgram, module, degree, type, semester, q, status, author,
				editor);

		return projectReadService.list(user, filter, pageable);
	}

	/**
	 * Ein einzelnes Projekt.
	 *
	 * <p>Die drei Fehlerfaelle folgen §6.3.1 und sind bewusst unterscheidbar:
	 * 404, wenn es die ID nicht gibt, 401 ohne Anmeldung, 403 bei fehlendem
	 * Leserecht. Die Existenz einer Ressource wird also nicht verschleiert.
	 */
	@Operation(summary = "Projekt lesen",
			description = "Metadaten, Mitglieder, Inhalt (geordnet) und version. Die Felder "
					+ "\"editors\" und \"statusHistory\" sind nur fuer die Projektseite, die "
					+ "zugewiesene Redaktion und Admins gefuellt, sonst null (§3.12).")
	@ApiResponse(responseCode = "200", description = "Das Projekt.")
	@ApiResponse(responseCode = "401", description = "Das Projekt ist nicht oeffentlich und es "
			+ "wurde kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber ohne Leserecht auf dieses "
			+ "Projekt.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@GetMapping("/{id}")
	public ProjectDetailResponse detail(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("id") UUID id) {

		return projectReadService.detail(user, id);
	}
}
