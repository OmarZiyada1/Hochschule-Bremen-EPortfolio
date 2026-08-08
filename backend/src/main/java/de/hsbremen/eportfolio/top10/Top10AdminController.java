package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.top10.dto.Top10AcceptRequest;
import de.hsbremen.eportfolio.top10.dto.Top10EntryResponse;
import de.hsbremen.eportfolio.top10.dto.Top10NominationResponse;
import de.hsbremen.eportfolio.top10.dto.Top10OrderRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die vier Top-10-Zeilen des Admin-Bereichs aus API-Contract §6.1 (KAN-24):
 * Protokoll lesen, Nominierung annehmen oder ablehnen, Reihenfolge setzen.
 *
 * <p><strong>Die Rollenebene liegt in der Filterkette.</strong>
 * {@code SecurityConfig} fuehrt {@code /api/admin/**} mit
 * {@code hasRole("ADMIN")}; ohne Token endet ein Aufruf mit 401, mit fremdem
 * Token mit 403. Die Dienste pruefen {@code mayCurateTop10} trotzdem noch
 * einmal, weil die Hausregel Berechtigungen zweistufig fuehrt und ein Pfadmuster
 * allein keine Rechtematrix ist (§5).
 *
 * <p><strong>Kein {@code version} in den Bodies</strong>, anders als bei den
 * schreibenden Projekt-Endpoints (§6.4). Die Top-10 ist keine Ressource mit
 * mehreren gleichberechtigten Bearbeiter:innen: sie wird ausschliesslich von der
 * Administration und ausschliesslich ueber diese Endpoints geschrieben. Gegen
 * den doppelten Klick auf „Annehmen" schuetzt der Stand der Nominierung selbst
 * (409 {@code NOMINATION_ALREADY_DECIDED}), gegen zwei gleichzeitige
 * Umsortierungen die vollstaendige Ersetzung: die zweite gewinnt und ist
 * vollstaendig, statt beide Listen zu vermischen.
 */
@RestController
@RequestMapping("/api/admin")
@Tag(name = "Top-10-Verwaltung", description = "Kuratierung der Startseiten-Auswahl (§3.11). "
		+ "Ausschliesslich fuer ADMIN (§5).")
public class Top10AdminController {

	private final Top10Service top10Service;

	private final Top10NominationService nominationService;

	public Top10AdminController(Top10Service top10Service,
			Top10NominationService nominationService) {
		this.top10Service = top10Service;
		this.nominationService = nominationService;
	}

	// ------------------------------------------------------------------
	// GET /api/admin/top10-nominations
	// ------------------------------------------------------------------

	@Operation(summary = "Nominierungen lesen",
			description = "Das Nominierungsprotokoll, neueste zuerst. Enthaelt offene und "
					+ "bereits entschiedene Vorschlaege (§3.11); mit dem Parameter \"status\" "
					+ "auf einen Stand eingegrenzt. Ohne Paginierung, weil §6.1 fuer diese "
					+ "Zeile keine vorsieht.")
	@ApiResponse(responseCode = "200", description = "Liste der Nominierungen.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: \"status\" ist kein "
			+ "Wert aus §2.8.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@GetMapping("/top10-nominations")
	public List<Top10NominationResponse> nominations(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "Optionaler Filter auf den Stand der Nominierung (§2.8). "
					+ "Ohne Angabe kommen alle.")
			@RequestParam(name = "status", required = false) NominationStatus status) {

		return nominationService.nominations(user, status);
	}

	// ------------------------------------------------------------------
	// POST /api/admin/top10-nominations/{id}/accept
	// ------------------------------------------------------------------

	@Operation(summary = "Nominierung annehmen",
			description = "Setzt status, decidedBy und decidedAt und legt den Top-10-Eintrag auf "
					+ "dem Platz aus dem Body an (§3.11). Der Platzvorschlag der nominierenden "
					+ "Person ist unverbindlich und wird nicht uebernommen. Ein belegter Platz "
					+ "wird nicht geraeumt: dafuer gibt es PUT /api/admin/top10.")
	@ApiResponse(responseCode = "200", description = "Die Nominierung steht auf ACCEPTED, das "
			+ "Projekt auf dem gewuenschten Platz.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: position fehlt oder "
			+ "liegt nicht zwischen 1 und 10.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "keine Nominierung.")
	@ApiResponse(responseCode = "409", description = "NOMINATION_ALREADY_DECIDED, wenn bereits "
			+ "entschieden wurde; PROJECT_NOT_PUBLISHED, wenn das Projekt inzwischen "
			+ "zurueckgezogen ist; RESOURCE_IN_USE, wenn der Platz belegt ist oder das Projekt "
			+ "schon in der Liste steht.")
	@PostMapping("/top10-nominations/{nominationId}/accept")
	public Top10NominationResponse accept(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Nominierung.")
			@PathVariable("nominationId") UUID nominationId,

			@RequestBody @Valid Top10AcceptRequest request) {

		return nominationService.accept(user, nominationId, request);
	}

	// ------------------------------------------------------------------
	// POST /api/admin/top10-nominations/{id}/reject
	// ------------------------------------------------------------------

	@Operation(summary = "Nominierung ablehnen",
			description = "Setzt status, decidedBy und decidedAt, ohne die Liste anzufassen "
					+ "(§3.11). Ohne Body: §6.1 sieht fuer diese Zeile keinen vor. Der Vorschlag "
					+ "bleibt als abgelehnter Eintrag im Protokoll stehen; dasselbe Projekt darf "
					+ "danach erneut nominiert werden.")
	@ApiResponse(responseCode = "200", description = "Die Nominierung steht auf REJECTED.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "keine Nominierung.")
	@ApiResponse(responseCode = "409", description = "NOMINATION_ALREADY_DECIDED: ueber diesen "
			+ "Vorschlag ist bereits entschieden worden.")
	@PostMapping("/top10-nominations/{nominationId}/reject")
	public Top10NominationResponse reject(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID der Nominierung.")
			@PathVariable("nominationId") UUID nominationId) {

		return nominationService.reject(user, nominationId);
	}

	// ------------------------------------------------------------------
	// PUT /api/admin/top10
	// ------------------------------------------------------------------

	@Operation(summary = "Top-10 setzen",
			description = "Ersetzt Bestand und Reihenfolge vollstaendig: der Index in "
					+ "projectIds ist der Platz, das erste Element steht auf Platz 1 (§3.11.1). "
					+ "Was nicht genannt ist, faellt aus der Liste; eine leere Liste leert sie. "
					+ "Zulaessig sind hoechstens zehn verschiedene, veroeffentlichte Projekte. "
					+ "Offene Nominierungen der aufgenommenen Projekte gelten damit als "
					+ "angenommen. Antwort ist die neue Liste wie bei GET /api/top10.")
	@ApiResponse(responseCode = "200", description = "Die neue Top-10, geordnet nach Platz.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: mehr als zehn Eintraege, "
			+ "ein Projekt mehrfach genannt, eine unbekannte ID oder ein nicht "
			+ "veroeffentlichtes Projekt.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@PutMapping("/top10")
	public List<Top10EntryResponse> setOrder(
			@AuthenticationPrincipal AuthenticatedUser user,

			@RequestBody @Valid Top10OrderRequest request) {

		return top10Service.setOrder(user, request);
	}
}
