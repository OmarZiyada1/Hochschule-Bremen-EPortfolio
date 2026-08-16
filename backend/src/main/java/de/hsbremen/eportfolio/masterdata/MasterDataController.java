package de.hsbremen.eportfolio.masterdata;

import de.hsbremen.eportfolio.masterdata.dto.CategoryResponse;
import de.hsbremen.eportfolio.masterdata.dto.FacultyResponse;
import de.hsbremen.eportfolio.masterdata.dto.ModuleResponse;
import de.hsbremen.eportfolio.masterdata.dto.SemesterResponse;
import de.hsbremen.eportfolio.masterdata.dto.StudyProgramResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die vier Stammdaten-Endpoints aus API-Contract §6.1.
 *
 * <p>Alle vier sind PUBLIC (§5) und in {@code SecurityConfig} bereits als
 * GET-Pfad freigegeben. Dort war die Regel schon vor dem Controller hinterlegt,
 * damit er nicht versehentlich hinter {@code anyRequest().authenticated()}
 * landet.
 *
 * <p>Die Antworten sind blanke Listen, kein {@code PageResponse}-Umschlag: es
 * sind Referenzlisten ohne Paginierung (Begruendung im
 * {@link MasterDataService}).
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Stammdaten", description = "Referenzlisten fuer Filter und Auswahlfelder (§6.1). "
		+ "Alle Endpoints sind ohne Token abrufbar.")
// Kein Bearer-Token noetig. Hebt die global in OpenApiConfig registrierte
// Anforderung fuer diesen Controller auf, damit die Swagger-UI hier kein
// Schloss anzeigt und nicht suggeriert, man muesse sich erst anmelden.
@SecurityRequirements
public class MasterDataController {

	private final MasterDataService masterDataService;

	public MasterDataController(MasterDataService masterDataService) {
		this.masterDataService = masterDataService;
	}

	@Operation(summary = "Kategorien lesen",
			description = "Alle Projektkategorien, nach Name sortiert. Ohne Paginierung.")
	@ApiResponse(responseCode = "200", description = "Liste der Kategorien.")
	@GetMapping("/categories")
	public List<CategoryResponse> categories() {
		return masterDataService.categories();
	}

	@Operation(summary = "Fakultaeten lesen",
			description = "Alle Fakultaeten, nach Name sortiert. Ohne Paginierung.")
	@ApiResponse(responseCode = "200", description = "Liste der Fakultaeten.")
	@GetMapping("/faculties")
	public List<FacultyResponse> faculties() {
		return masterDataService.faculties();
	}

	@Operation(summary = "Studiengaenge lesen",
			description = "Alle Studiengaenge, nach Name sortiert. Mit dem Parameter "
					+ "\"faculty\" auf eine Fakultaet eingeschraenkt; eine unbekannte "
					+ "ID ergibt eine leere Liste.")
	@ApiResponse(responseCode = "200", description = "Liste der Studiengaenge.")
	@ApiResponse(responseCode = "400", description = "\"faculty\" ist keine gueltige UUID.")
	@GetMapping("/study-programs")
	public List<StudyProgramResponse> studyPrograms(
			@Parameter(description = "Optionaler Filter: ID der Fakultaet aus GET /api/faculties. "
					+ "Ohne Angabe kommen alle Studiengaenge.")
			@RequestParam(name = "faculty", required = false) UUID faculty) {
		return masterDataService.studyPrograms(faculty);
	}

	@Operation(summary = "Module lesen",
			description = "Alle Module, nach Name sortiert. Mit dem Parameter "
					+ "\"studyProgram\" auf einen Studiengang eingeschraenkt; eine "
					+ "unbekannte ID ergibt eine leere Liste.")
	@ApiResponse(responseCode = "200", description = "Liste der Module.")
	@ApiResponse(responseCode = "400", description = "\"studyProgram\" ist keine gueltige UUID.")
	@GetMapping("/modules")
	public List<ModuleResponse> modules(
			@Parameter(description = "Optionaler Filter: ID des Studiengangs aus "
					+ "GET /api/study-programs. Ohne Angabe kommen alle Module.")
			@RequestParam(name = "studyProgram", required = false) UUID studyProgram) {
		return masterDataService.modules(studyProgram);
	}

	@Operation(summary = "Semester lesen",
			description = "Alle Semester in der von der Administration gepflegten Reihenfolge "
					+ "(§3.18). Ohne Paginierung. Mit \"active=true\" nur die, die bei der "
					+ "Projektanlage zur Auswahl stehen.")
	@ApiResponse(responseCode = "200", description = "Liste der Semester.")
	@ApiResponse(responseCode = "400", description = "\"active\" ist kein Wahrheitswert.")
	@GetMapping("/semesters")
	public List<SemesterResponse> semesters(
			@Parameter(description = "Optionaler Filter auf den Auswahlzustand. Ohne Angabe "
					+ "kommen alle Semester, auch die deaktivierten.")
			@RequestParam(name = "active", required = false) Boolean active) {
		return masterDataService.semesters(active);
	}
}
