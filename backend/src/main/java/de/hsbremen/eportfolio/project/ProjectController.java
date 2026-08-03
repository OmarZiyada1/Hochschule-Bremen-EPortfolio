package de.hsbremen.eportfolio.project;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.Degree;
import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.common.enums.ProjectType;
import de.hsbremen.eportfolio.project.dto.ProjectCardResponse;
import de.hsbremen.eportfolio.project.dto.ProjectCreateRequest;
import de.hsbremen.eportfolio.project.dto.ProjectDetailResponse;
import de.hsbremen.eportfolio.project.dto.ProjectEditorsRequest;
import de.hsbremen.eportfolio.project.dto.ProjectFilterRequest;
import de.hsbremen.eportfolio.project.dto.ProjectUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die Projekt-Endpoints aus API-Contract §6.1, ohne Bloecke (KAN-18) und ohne
 * die Statusuebergaenge (KAN-19).
 *
 * <p><strong>Zwei Zugriffsarten in einem Controller.</strong> Die beiden
 * GET-Pfade sind in {@code SecurityConfig} als PUBLIC-GET freigegeben; die
 * Regeln standen dort schon vor diesem Controller, damit er nicht versehentlich
 * hinter {@code anyRequest().authenticated()} landet. „Frei erreichbar" heisst
 * ausdruecklich nicht „alles sichtbar": was ein Aufrufer bekommt, entscheidet
 * der {@link ProjectReadService} anhand der Rechtematrix (§5). Ohne Token ist
 * {@code @AuthenticationPrincipal} {@code null}, und genau das ist der
 * PUBLIC-Fall aus §2.1. Die vier schreibenden Pfade sind von dieser Freigabe
 * nicht erfasst und verlangen deshalb ein Token.
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen, Statuscode
 * setzen. Filterlogik, Berechtigungen, Statusregeln und Fehlerpolitik liegen in
 * {@link ProjectReadService} und {@link ProjectWriteService}.
 */
@RestController
@RequestMapping("/api/projects")
@Tag(name = "Projekte", description = "Projektliste, Projektdetail und die Pflege der "
		+ "Projekt-Metadaten (§6.1). Ohne Token sind nur veroeffentlichte Projekte sichtbar und "
		+ "kein schreibender Zugriff moeglich; mit Token richtet sich der Umfang nach der "
		+ "Rechtematrix aus §5 und dem Projektstatus aus §4.1.")
public class ProjectController {

	private final ProjectReadService projectReadService;

	private final ProjectWriteService projectWriteService;

	public ProjectController(ProjectReadService projectReadService,
			ProjectWriteService projectWriteService) {
		this.projectReadService = projectReadService;
		this.projectWriteService = projectWriteService;
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

	// ==================================================================
	// Schreibende Endpoints (KAN-17)
	//
	// Sie brauchen alle eine Anmeldung. In SecurityConfig steht dafuer keine
	// eigene Zeile: dort ist ausdruecklich nur GET auf diese Pfade
	// freigegeben, alles Uebrige faellt unter anyRequest().authenticated()
	// und ergibt ohne Token 401 NOT_AUTHENTICATED. Deshalb ist
	// @AuthenticationPrincipal hier nie null, anders als bei den beiden
	// Lese-Endpoints daruber.
	// ==================================================================

	/**
	 * Projekt anlegen.
	 *
	 * <p>Die Antwort hat dieselbe Form wie {@link #detail}, damit der Client
	 * nach dem Anlegen sofort {@code version} und die server-vergebene ID hat
	 * und nicht nachladen muss.
	 */
	@Operation(summary = "Projekt anlegen",
			description = "Legt ein Projekt im Status DRAFT an (§4.1). Pflicht ist allein der "
					+ "Titel; die uebrigen Metadaten duerfen im Entwurf fehlen und werden erst "
					+ "beim Einreichen verlangt (§3.3). Autor:in ist die angemeldete Person.")
	@ApiResponse(responseCode = "201", description = "Das angelegte Projekt.")
	@ApiResponse(responseCode = "400", description = "Titel fehlt, mehr als fuenf Tags, oder eine "
			+ "im Body genannte ID (Kategorie, Fakultaet, Studiengang, Modul, Mitglied, "
			+ "Redakteur:in) gibt es nicht.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber ohne Recht zum Anlegen, "
			+ "oder es wurden editorIds gesetzt, obwohl die Rolle das nicht darf (§5, Fussnote 3).")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public ProjectDetailResponse create(
			@AuthenticationPrincipal AuthenticatedUser user,
			@Valid @RequestBody ProjectCreateRequest request) {

		return projectWriteService.create(user, request);
	}

	/**
	 * Metadaten eines Projekts aendern.
	 *
	 * <p>Ausdruecklich nicht der Inhalt: der laeuft ueber
	 * {@code PUT /api/projects/{id}/blocks} (KAN-18). Die Trennung besteht,
	 * weil der Editor zeitversetzt automatisch speichert und dabei sonst bei
	 * jedem Tastenanschlag die Metadaten mitschreiben wuerde (§6.1).
	 */
	@Operation(summary = "Projekt-Metadaten aendern",
			description = "Aendert nur die Metadaten, nicht den Inhalt. Erlaubt sind Autor:in und "
					+ "Projektmitglieder, und nur in den Status DRAFT und REVISION (§4.1). "
					+ "Einzelfelder werden ersetzt, ein fehlendes Feld wird also null; die "
					+ "Sammlungen tags, editorIds und members bleiben bei null unveraendert und "
					+ "werden mit [] geleert.")
	@ApiResponse(responseCode = "200", description = "Das geaenderte Projekt.")
	@ApiResponse(responseCode = "400", description = "Titel oder version fehlen, mehr als fuenf "
			+ "Tags, oder eine im Body genannte ID gibt es nicht.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber nicht Teil der Projektseite, "
			+ "oder es wurden editorIds geaendert, obwohl das nur der Autor:in im DRAFT zusteht.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_STATUS_NOT_EDITABLE, wenn der Status "
			+ "die Bearbeitung sperrt (§4.1); PROJECT_VERSION_CONFLICT, wenn die mitgeschickte "
			+ "version veraltet ist (§6.4).")
	@PutMapping("/{id}")
	public ProjectDetailResponse update(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("id") UUID id,

			@Valid @RequestBody ProjectUpdateRequest request) {

		return projectWriteService.update(user, id, request);
	}

	/**
	 * Zustaendige Redaktion neu verteilen.
	 *
	 * <p>Der einzige Weg zur Redaktionszuweisung, der auch nach dem Einreichen
	 * offen ist, und deshalb Admin-only (§6.1). Die Autor:in waehlt ihre
	 * Redaktion ueber {@link #create} und {@link #update}.
	 */
	@Operation(summary = "Zustaendige Redaktion neu verteilen",
			description = "Ersetzt die Liste der zugewiesenen Redakteur:innen vollstaendig. Nur "
					+ "fuer ADMIN, dafuer jederzeit und unabhaengig vom Status (§6.1). Ohne "
					+ "version-Feld, weil hier nichts ueberschrieben werden kann, woran die "
					+ "Projektseite parallel arbeitet.")
	@ApiResponse(responseCode = "200", description = "Das Projekt mit der neuen Zuweisung.")
	@ApiResponse(responseCode = "400", description = "editorIds fehlt, oder eine der IDs gehoert zu "
			+ "keinem Konto mit der Rolle EDITOR oder ADMIN.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber kein Admin.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@PutMapping("/{id}/editors")
	public ProjectDetailResponse reassignEditors(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("id") UUID id,

			@Valid @RequestBody ProjectEditorsRequest request) {

		return projectWriteService.reassignEditors(user, id, request);
	}

	/** Projekt loeschen. */
	@Operation(summary = "Projekt loeschen",
			description = "Die Autor:in darf nur im Status DRAFT loeschen, der Admin jederzeit "
					+ "(§6.1). Bloecke, Tags, Mitglieder, Kommentare, Reaktionen und die "
					+ "Statushistorie fallen per Cascade mit.")
	@ApiResponse(responseCode = "204", description = "Geloescht.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "Angemeldet, aber ohne Loeschrecht auf dieses "
			+ "Projekt, etwa als Autor:in eines bereits eingereichten Projekts.")
	@ApiResponse(responseCode = "404", description = "Unter dieser ID gibt es kein Projekt.")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("id") UUID id) {

		projectWriteService.delete(user, id);
	}
}
