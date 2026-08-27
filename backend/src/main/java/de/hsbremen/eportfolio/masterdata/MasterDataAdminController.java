package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.masterdata.dto.CategoryCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.CategoryMergeRequest;
import de.hsbremen.eportfolio.masterdata.dto.CategoryResponse;
import de.hsbremen.eportfolio.masterdata.dto.CategoryUpdateRequest;
import de.hsbremen.eportfolio.masterdata.dto.FacultyCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.FacultyResponse;
import de.hsbremen.eportfolio.masterdata.dto.FacultyUpdateRequest;
import de.hsbremen.eportfolio.masterdata.dto.ModuleCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.ModuleResponse;
import de.hsbremen.eportfolio.masterdata.dto.ModuleUpdateRequest;
import de.hsbremen.eportfolio.masterdata.dto.SemesterCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.SemesterMoveRequest;
import de.hsbremen.eportfolio.masterdata.dto.SemesterResponse;
import de.hsbremen.eportfolio.masterdata.dto.SemesterUpdateRequest;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramCreateRequest;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramResponse;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die Stammdaten-Zeilen des Admin-Bereichs aus API-Contract §6.1 (KAN-25):
 * {@code POST}, {@code PATCH} und {@code DELETE} fuer Kategorien, Fakultaeten,
 * Studiengaenge, Module und seit KAN-65 Semester, dazu seit KAN-46 das
 * Zusammenfuehren zweier Kategorien und das Umsortieren der Semester.
 *
 * <p><strong>Getrennt vom {@link MasterDataController}</strong>, der dieselben
 * Tabellen unter {@code /api} liest. Die Lese-Endpoints sind PUBLIC und
 * heben in der Swagger-UI die Token-Anforderung ausdruecklich auf; diese hier
 * sind das Gegenteil. Beides in einem Controller waere eine Klasse, in der die
 * Haelfte der Methoden ein Token braucht und die andere nicht, und die
 * OpenAPI-Beschreibung koennte das nur noch je Methode ausdruecken.
 *
 * <p><strong>Die Rollenebene liegt in der Filterkette</strong>, wie beim
 * {@code Top10AdminController}: {@code SecurityConfig} fuehrt
 * {@code /api/admin/**} mit {@code hasRole("ADMIN")}. Der Dienst prueft
 * {@code mayManageMasterData} trotzdem noch einmal (§5).
 *
 * <p><strong>Kein {@code GET} hier.</strong> Die Administrationsseite liest die
 * Listen ueber die vorhandenen PUBLIC-Endpoints; §6.1 fuehrt fuer die
 * Stammdaten im Admin-Bereich nur schreibende Zeilen. Das {@code move} des
 * Semesters ist die einzige Ausnahme von der Regel, dass hier nichts liest: es
 * antwortet mit der ganzen Liste, weil ein Tausch zwei Zeilen betrifft. Ein zweiter Lesepfad mit
 * identischer Antwort waere eine Kopie, die beim naechsten Feld
 * auseinanderlaeuft.
 */
@RestController
@RequestMapping("/api/admin")
@Tag(name = "Stammdatenverwaltung", description = "Kategorien, Fakultaeten, Studiengaenge, "
		+ "Module und Semester anlegen, aendern und loeschen (§6.1). Ausschliesslich fuer ADMIN "
		+ "(§5). Gelesen werden die Listen ueber die PUBLIC-Endpoints unter /api.")
public class MasterDataAdminController {

	private static final String IN_USE = "RESOURCE_IN_USE: der eindeutige Wert ist bereits "
			+ "vergeben, oder beim Loeschen verweisen noch andere Zeilen darauf.";

	private static final String UNAUTHORIZED = "Kein gueltiges Token mitgeschickt.";

	private static final String FORBIDDEN = "NO_PERMISSION: die Rolle ist nicht ADMIN.";

	private static final String NOT_FOUND =
			"RESOURCE_NOT_FOUND: unter dieser ID gibt es keine solche Zeile.";

	private final MasterDataAdminService adminService;

	public MasterDataAdminController(MasterDataAdminService adminService) {
		this.adminService = adminService;
	}

	// ==================================================================
	// Kategorien (§3.6)
	// ==================================================================

	@Operation(summary = "Kategorie anlegen",
			description = "Der Name ist eindeutig; ein bereits vergebener ergibt 409.")
	@ApiResponse(responseCode = "201", description = "Die angelegte Kategorie.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: Name fehlt oder ist zu lang.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@PostMapping("/categories")
	@ResponseStatus(HttpStatus.CREATED)
	public CategoryResponse createCategory(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody @Valid CategoryCreateRequest request) {

		return adminService.createCategory(user, request);
	}

	@Operation(summary = "Kategorie aendern",
			description = "Das Feld ist optional; fehlt es, bleibt der Name unveraendert.")
	@ApiResponse(responseCode = "200", description = "Die geaenderte Kategorie.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: uebermittelter Name ist "
			+ "leer oder zu lang.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@PatchMapping("/categories/{id}")
	public CategoryResponse updateCategory(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Kategorie.")
			@PathVariable("id") UUID id,

			@RequestBody @Valid CategoryUpdateRequest request) {

		return adminService.updateCategory(user, id, request);
	}

	@Operation(summary = "Kategorie loeschen",
			description = "Gesperrt, solange noch Projekte auf die Kategorie verweisen (409). "
					+ "Sonst verloeren diese Projekte ihre Klassifikation ohne Vorwarnung.")
	@ApiResponse(responseCode = "204", description = "Die Kategorie ist geloescht.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@DeleteMapping("/categories/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteCategory(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Kategorie.")
			@PathVariable("id") UUID id) {

		adminService.deleteCategory(user, id);
	}

	@Operation(summary = "Kategorien zusammenfuehren",
			description = "Haengt alle Projekte der Kategorie aus dem Pfad an die Kategorie aus "
					+ "dem Body um und loescht danach die Quelle. Der einzige Weg, eine doppelt "
					+ "angelegte Kategorie aufzuraeumen: das Loeschen ist gesperrt, solange noch "
					+ "Projekte daran haengen. Die Antwort ist die Zielkategorie.")
	@ApiResponse(responseCode = "200", description = "Die Zielkategorie; die Quelle ist geloescht.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: targetCategoryId fehlt, "
			+ "ist unbekannt oder gleich der ID im Pfad.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter der ID im Pfad "
			+ "gibt es keine Kategorie. Eine unbekannte ID im Body ergibt dagegen 400 (§6.3.1).")
	@PostMapping("/categories/{id}/merge")
	public CategoryResponse mergeCategory(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Quellkategorie. Sie ist am Ende geloescht.")
			@PathVariable("id") UUID id,

			@RequestBody @Valid CategoryMergeRequest request) {

		return adminService.mergeCategory(user, id, request);
	}

	// ==================================================================
	// Fakultaeten (§3.8)
	// ==================================================================

	@Operation(summary = "Fakultaet anlegen",
			description = "Eindeutig ist das Kuerzel, nicht der Name.")
	@ApiResponse(responseCode = "201", description = "Die angelegte Fakultaet.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: Name oder Kuerzel fehlt.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@PostMapping("/faculties")
	@ResponseStatus(HttpStatus.CREATED)
	public FacultyResponse createFaculty(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody @Valid FacultyCreateRequest request) {

		return adminService.createFaculty(user, request);
	}

	@Operation(summary = "Fakultaet aendern",
			description = "Beide Felder sind optional; was fehlt, bleibt stehen.")
	@ApiResponse(responseCode = "200", description = "Die geaenderte Fakultaet.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: uebermittelter Name oder "
			+ "uebermitteltes Kuerzel ist leer oder zu lang.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@PatchMapping("/faculties/{id}")
	public FacultyResponse updateFaculty(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Fakultaet.")
			@PathVariable("id") UUID id,

			@RequestBody @Valid FacultyUpdateRequest request) {

		return adminService.updateFaculty(user, id, request);
	}

	@Operation(summary = "Fakultaet loeschen",
			description = "Gesperrt, solange noch Studiengaenge oder Projekte darauf verweisen "
					+ "(409).")
	@ApiResponse(responseCode = "204", description = "Die Fakultaet ist geloescht.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@DeleteMapping("/faculties/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteFaculty(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Fakultaet.")
			@PathVariable("id") UUID id) {

		adminService.deleteFaculty(user, id);
	}

	// ==================================================================
	// Studiengaenge (§3.7)
	// ==================================================================

	@Operation(summary = "Studiengang anlegen",
			description = "Die Fakultaet ist Pflicht; eine unbekannte facultyId ergibt 400.")
	@ApiResponse(responseCode = "201", description = "Der angelegte Studiengang.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: Name oder Fakultaet "
			+ "fehlt, oder unter der facultyId gibt es keine Fakultaet.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@PostMapping("/study-programs")
	@ResponseStatus(HttpStatus.CREATED)
	public StudyProgramResponse createStudyProgram(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody @Valid StudyProgramCreateRequest request) {

		return adminService.createStudyProgram(user, request);
	}

	@Operation(summary = "Studiengang aendern",
			description = "Alle drei Felder sind optional; was fehlt, bleibt stehen. Eine leere "
					+ "Zeichenkette in \"abbreviation\" loescht die Kurzform.")
	@ApiResponse(responseCode = "200", description = "Der geaenderte Studiengang.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: uebermittelter Name ist "
			+ "leer, oder unter der facultyId gibt es keine Fakultaet.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@PatchMapping("/study-programs/{id}")
	public StudyProgramResponse updateStudyProgram(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Studiengangs.")
			@PathVariable("id") UUID id,

			@RequestBody @Valid StudyProgramUpdateRequest request) {

		return adminService.updateStudyProgram(user, id, request);
	}

	@Operation(summary = "Studiengang loeschen",
			description = "Gesperrt, solange noch Fachmodule oder Projekte darauf verweisen "
					+ "(409). Das Sammelmodul des Studiengangs zaehlt dabei nicht mit und wird "
					+ "mitgeloescht (§3.9, seit Contract v84); verweist ein Projekt darauf, "
					+ "bleibt es bei 409.")
	@ApiResponse(responseCode = "204", description = "Der Studiengang ist geloescht.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@DeleteMapping("/study-programs/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteStudyProgram(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Studiengangs.")
			@PathVariable("id") UUID id) {

		adminService.deleteStudyProgram(user, id);
	}

	// ==================================================================
	// Module (§3.9)
	// ==================================================================

	@Operation(summary = "Modul anlegen",
			description = "Der Studiengang ist Pflicht; eine unbekannte studyProgramId ergibt 400.")
	@ApiResponse(responseCode = "201", description = "Das angelegte Modul.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: Name oder Studiengang "
			+ "fehlt, oder unter der studyProgramId gibt es keinen Studiengang.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@PostMapping("/modules")
	@ResponseStatus(HttpStatus.CREATED)
	public ModuleResponse createModule(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody @Valid ModuleCreateRequest request) {

		return adminService.createModule(user, request);
	}

	@Operation(summary = "Modul aendern",
			description = "Alle drei Felder sind optional; was fehlt, bleibt stehen. Eine leere "
					+ "Zeichenkette in \"abbreviation\" loescht die Kurzform. Das Sammelmodul "
					+ "(collective) laesst sich umbenennen, aber nicht umhaengen (§3.9).")
	@ApiResponse(responseCode = "200", description = "Das geaenderte Modul.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: uebermittelter Name ist "
			+ "leer, unter der studyProgramId gibt es keinen Studiengang, oder es soll das "
			+ "Sammelmodul an einen anderen Studiengang gehaengt werden.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@PatchMapping("/modules/{id}")
	public ModuleResponse updateModule(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Moduls.")
			@PathVariable("id") UUID id,

			@RequestBody @Valid ModuleUpdateRequest request) {

		return adminService.updateModule(user, id, request);
	}

	@Operation(summary = "Modul loeschen",
			description = "Gesperrt, solange noch Projekte darauf verweisen (409). Das "
					+ "Sammelmodul eines Studiengangs laesst sich gar nicht einzeln loeschen "
					+ "und faellt mit seinem Studiengang (§3.9, seit Contract v84).")
	@ApiResponse(responseCode = "204", description = "Das Modul ist geloescht.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@DeleteMapping("/modules/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteModule(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Moduls.")
			@PathVariable("id") UUID id) {

		adminService.deleteModule(user, id);
	}

	// ==================================================================
	// Semester (§3.18)
	// ==================================================================

	@Operation(summary = "Semester anlegen",
			description = "Der Name ist eindeutig; ein bereits vergebener ergibt 409. Die neue "
					+ "Zeile steht am Ende der Reihenfolge und wird ueber \"move\" verschoben.")
	@ApiResponse(responseCode = "201", description = "Das angelegte Semester.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: Name fehlt oder ist zu lang.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@PostMapping("/semesters")
	@ResponseStatus(HttpStatus.CREATED)
	public SemesterResponse createSemester(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody @Valid SemesterCreateRequest request) {

		return adminService.createSemester(user, request);
	}

	@Operation(summary = "Semester aendern",
			description = "Beide Felder sind optional; was fehlt, bleibt stehen. Ueber \"active\" "
					+ "laeuft auch das Deaktivieren: ein inaktives Semester steht bei der "
					+ "Projektanlage nicht mehr zur Auswahl, bleibt an bestehenden Projekten aber "
					+ "erhalten.")
	@ApiResponse(responseCode = "200", description = "Das geaenderte Semester.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: uebermittelter Name ist "
			+ "leer oder zu lang.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@PatchMapping("/semesters/{id}")
	public SemesterResponse updateSemester(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Semesters.")
			@PathVariable("id") UUID id,

			@RequestBody @Valid SemesterUpdateRequest request) {

		return adminService.updateSemester(user, id, request);
	}

	@Operation(summary = "Semester loeschen",
			description = "Gesperrt, solange noch Projekte darauf verweisen (409). Ein "
					+ "abgelaufenes Semester wird deaktiviert und nicht geloescht.")
	@ApiResponse(responseCode = "204", description = "Das Semester ist geloescht.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@ApiResponse(responseCode = "409", description = IN_USE)
	@DeleteMapping("/semesters/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteSemester(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Semesters.")
			@PathVariable("id") UUID id) {

		adminService.deleteSemester(user, id);
	}

	@Operation(summary = "Semester umsortieren",
			description = "Tauscht das Semester mit seiner Nachbarzeile. Am oberen "
					+ "beziehungsweise unteren Rand ist die Aktion wirkungslos und ergibt "
					+ "trotzdem 200, weil der gewuenschte Zustand bereits besteht. Die Antwort "
					+ "ist die vollstaendige neue Reihenfolge.")
	@ApiResponse(responseCode = "200", description = "Alle Semester in der neuen Reihenfolge.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: \"direction\" fehlt oder "
			+ "ist weder UP noch DOWN.")
	@ApiResponse(responseCode = "401", description = UNAUTHORIZED)
	@ApiResponse(responseCode = "403", description = FORBIDDEN)
	@ApiResponse(responseCode = "404", description = NOT_FOUND)
	@PostMapping("/semesters/{id}/move")
	public List<SemesterResponse> moveSemester(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Semesters, das bewegt wird.")
			@PathVariable("id") UUID id,

			@RequestBody @Valid SemesterMoveRequest request) {

		return adminService.moveSemester(user, id, request);
	}
}
