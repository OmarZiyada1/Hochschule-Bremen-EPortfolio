package de.hsbremen.eportfolio.stammdaten;

import de.hsbremen.eportfolio.stammdaten.dto.FakultaetAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.KategorieAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.ModulAntwort;
import de.hsbremen.eportfolio.stammdaten.dto.StudiengangAntwort;
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
 * GET-Pfad freigegeben — dort war die Regel schon vor dem Controller
 * hinterlegt, damit er nicht versehentlich hinter
 * {@code anyRequest().authenticated()} landet.
 *
 * <p>Die Antworten sind blanke Listen, kein {@code SeiteAntwort}-Umschlag: es
 * sind Referenzlisten ohne Paginierung (Begruendung im
 * {@link StammdatenService}).
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Stammdaten", description = "Referenzlisten fuer Filter und Auswahlfelder (§6.1). "
		+ "Alle Endpoints sind ohne Token abrufbar.")
// Kein Bearer-Token noetig. Hebt die global in OpenApiConfig registrierte
// Anforderung fuer diesen Controller auf, damit die Swagger-UI hier kein
// Schloss anzeigt und nicht suggeriert, man muesse sich erst anmelden.
@SecurityRequirements
public class StammdatenController {

	private final StammdatenService stammdatenService;

	public StammdatenController(StammdatenService stammdatenService) {
		this.stammdatenService = stammdatenService;
	}

	@Operation(summary = "Kategorien lesen",
			description = "Alle Projektkategorien, nach Name sortiert. Ohne Paginierung.")
	@ApiResponse(responseCode = "200", description = "Liste der Kategorien.")
	@GetMapping("/kategorien")
	public List<KategorieAntwort> kategorien() {
		return stammdatenService.kategorien();
	}

	@Operation(summary = "Fakultaeten lesen",
			description = "Alle Fakultaeten, nach Name sortiert. Ohne Paginierung.")
	@ApiResponse(responseCode = "200", description = "Liste der Fakultaeten.")
	@GetMapping("/fakultaeten")
	public List<FakultaetAntwort> fakultaeten() {
		return stammdatenService.fakultaeten();
	}

	@Operation(summary = "Studiengaenge lesen",
			description = "Alle Studiengaenge, nach Name sortiert. Mit dem Parameter "
					+ "\"fakultaet\" auf eine Fakultaet eingeschraenkt; eine unbekannte "
					+ "ID ergibt eine leere Liste.")
	@ApiResponse(responseCode = "200", description = "Liste der Studiengaenge.")
	@ApiResponse(responseCode = "400", description = "\"fakultaet\" ist keine gueltige UUID.")
	@GetMapping("/studiengaenge")
	public List<StudiengangAntwort> studiengaenge(
			@Parameter(description = "Optionaler Filter: ID der Fakultaet aus GET /api/fakultaeten. "
					+ "Ohne Angabe kommen alle Studiengaenge.")
			@RequestParam(name = "fakultaet", required = false) UUID fakultaet) {
		return stammdatenService.studiengaenge(fakultaet);
	}

	@Operation(summary = "Module lesen",
			description = "Alle Module, nach Name sortiert. Mit dem Parameter "
					+ "\"studiengang\" auf einen Studiengang eingeschraenkt; eine "
					+ "unbekannte ID ergibt eine leere Liste.")
	@ApiResponse(responseCode = "200", description = "Liste der Module.")
	@ApiResponse(responseCode = "400", description = "\"studiengang\" ist keine gueltige UUID.")
	@GetMapping("/module")
	public List<ModulAntwort> module(
			@Parameter(description = "Optionaler Filter: ID des Studiengangs aus "
					+ "GET /api/studiengaenge. Ohne Angabe kommen alle Module.")
			@RequestParam(name = "studiengang", required = false) UUID studiengang) {
		return stammdatenService.module(studiengang);
	}
}
