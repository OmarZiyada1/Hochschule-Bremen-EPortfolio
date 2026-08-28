package de.hsbremen.eportfolio.support;

import de.hsbremen.eportfolio.common.dto.PageResponse;
import de.hsbremen.eportfolio.common.enums.SupportRequestCategory;
import de.hsbremen.eportfolio.common.enums.SupportRequestStatus;
import de.hsbremen.eportfolio.support.dto.SupportRequestResponse;
import de.hsbremen.eportfolio.support.dto.SupportRequestStatusUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die Verwaltung der eingegangenen Support-Anfragen (§6.1, Abschnitt
 * „Support"): Liste, Statuswechsel und Loeschen.
 *
 * <p><strong>Die Rollenebene liegt vollstaendig in der Filterkette.</strong>
 * {@code SecurityConfig} fuehrt {@code /api/admin/**} mit
 * {@code hasRole("ADMIN")}. Anders als bei den Projekt- und Nutzer-Endpoints
 * folgt danach keine zweite Pruefung: Support ist keine Projektressource, es
 * gibt keine Autor:in, keine Zugehoerigkeit und keinen Status, an dem ein
 * Ressourcenrecht haengen koennte (§5). Ein {@code may…} im
 * {@code ProjectPermissionService} waere eine Methode, die immer dasselbe
 * antwortet.
 *
 * <p><strong>Kein Endpoint aendert den Inhalt einer Anfrage.</strong>
 * {@code PATCH} nimmt ausschliesslich {@code status} entgegen; Name, Adresse,
 * Kategorie, Betreff und Text stehen nach dem Eingang fest (§3.20). Ebenso
 * wenig gibt es einen Endpoint, der eine Antwort verschickt oder speichert:
 * geantwortet wird im eigenen Postfach, die Oberflaeche bietet dafuer nur einen
 * Verweis ins Mailprogramm an.
 */
@RestController
@RequestMapping("/api/admin/support")
@Tag(name = "Support-Verwaltung", description = "Eingegangene Anfragen aus dem Kontaktformular "
		+ "lesen, ihren Stand setzen und sie loeschen (§6.1). Ausschliesslich fuer ADMIN (§5).")
public class SupportAdminController {

	private final SupportService supportService;

	public SupportAdminController(SupportService supportService) {
		this.supportService = supportService;
	}

	// ------------------------------------------------------------------
	// GET /api/admin/support
	// ------------------------------------------------------------------

	@Operation(summary = "Support-Anfragen lesen",
			description = "Die eingegangenen Anfragen im Seitenformat aus §6.6, neueste zuerst. "
					+ "Der Endpoint kennt keinen \"sort\"-Parameter: ein Eingangsbuch wird von "
					+ "hinten gelesen, und nach Name oder Adresse zu sortieren verdeckte gerade "
					+ "die zeitliche Naehe, an der eine Serie erkennbar ist (§6.6). Wer "
					+ "einschraenken will, nimmt die beiden Filter. Die Zaehlung \"N offen\" der "
					+ "Oberflaeche ist derselbe Aufruf mit status=OPEN und size=1.")
	@ApiResponse(responseCode = "200", description = "Eine Seite der Anfragenliste.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: \"status\" oder "
			+ "\"category\" ist kein Wert aus §2.15 bzw. §2.14.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@GetMapping
	public PageResponse<SupportRequestResponse> list(

			@Parameter(description = "Filter: Bearbeitungsstand (§2.15).")
			@RequestParam(name = "status", required = false) SupportRequestStatus status,

			@Parameter(description = "Filter: Kategorie (§2.14).")
			@RequestParam(name = "category", required = false) SupportRequestCategory category,

			@ParameterObject
			@PageableDefault(size = 20)
			Pageable pageable) {

		return supportService.list(status, category, pageable);
	}

	// ------------------------------------------------------------------
	// PATCH /api/admin/support/{id}
	// ------------------------------------------------------------------

	@Operation(summary = "Bearbeitungsstand setzen",
			description = "Setzt den Stand einer Anfrage (§2.15). Erlaubt sind OPEN nach "
					+ "IN_PROGRESS, OPEN nach RESOLVED, IN_PROGRESS nach RESOLVED und RESOLVED "
					+ "zurueck nach OPEN. Jeder andere Uebergang ergibt 409, einschliesslich des "
					+ "erneuten Setzens des bereits stehenden Werts.")
	@ApiResponse(responseCode = "200", description = "Die geaenderte Anfrage.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: \"status\" fehlt oder "
			+ "ist kein Wert aus §2.15.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt "
			+ "es keine Anfrage.")
	@ApiResponse(responseCode = "409", description = "SUPPORT_STATUS_TRANSITION_INVALID: der "
			+ "Uebergang steht nicht in §2.15.")
	@PatchMapping("/{id}")
	public SupportRequestResponse updateStatus(

			@Parameter(description = "ID der Anfrage.")
			@PathVariable("id") UUID id,

			@Valid @RequestBody SupportRequestStatusUpdateRequest request) {

		return supportService.updateStatus(id, request.status());
	}

	// ------------------------------------------------------------------
	// DELETE /api/admin/support/{id}
	// ------------------------------------------------------------------

	@Operation(summary = "Support-Anfrage loeschen",
			description = "Entfernt die Anfrage endgueltig. Kein Soft-Delete und kein "
					+ "Archivzustand: RESOLVED ist der Abschluss, geloescht wird, was gar nicht "
					+ "bleiben soll (§2.15).")
	@ApiResponse(responseCode = "204", description = "Die Anfrage ist entfernt.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt "
			+ "es keine Anfrage.")
	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(
			@Parameter(description = "ID der Anfrage.")
			@PathVariable("id") UUID id) {

		supportService.delete(id);
	}
}
