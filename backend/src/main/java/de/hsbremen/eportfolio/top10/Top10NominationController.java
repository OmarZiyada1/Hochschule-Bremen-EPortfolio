package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.top10.dto.Top10NominationRequest;
import de.hsbremen.eportfolio.top10.dto.Top10NominationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die Nominierung eines Projekts fuer die Top-10 aus API-Contract §6.1
 * (KAN-24).
 *
 * <p><strong>Warum der Endpoint am Projektpfad haengt und trotzdem hier
 * liegt.</strong> Adressiert wird das Projekt, geschrieben wird eine
 * {@code Top10Nomination}; die Regeln dazu stehen in §3.11.1. Dasselbe Muster
 * wie beim {@code ReactionController}, der ebenfalls unter
 * {@code /api/projects/{id}/…} liegt und trotzdem im Paket seines Features.
 *
 * <p><strong>Zur Freigabe in {@code SecurityConfig}:</strong> dort steht fuer
 * {@code /api/projects/*} nur {@code GET} als PUBLIC-Pfad. Ein {@code POST} auf
 * diesen Pfad faellt damit unter {@code anyRequest().authenticated()} und ergibt
 * ohne Token 401, genau wie §5 es fuer die Zeile „Projekt fuer Top-10
 * nominieren" verlangt (PUBLIC ✗). Eine Rollenregel waere hier zu grob: sie
 * kaeme vor dem Laden des Projekts, und eine unbekannte ID ergaebe dann 403
 * statt 404 (§6.3.1).
 */
@RestController
@RequestMapping("/api/projects/{projectId}/top10-nomination")
@Tag(name = "Top-10", description = "Die kuratierte Auswahl der Startseite (§3.11). Ohne Token "
		+ "abrufbar; kuratiert wird sie ausschliesslich ueber die Administrationsseite.")
public class Top10NominationController {

	private final Top10NominationService nominationService;

	public Top10NominationController(Top10NominationService nominationService) {
		this.nominationService = nominationService;
	}

	@Operation(summary = "Projekt fuer die Top-10 nominieren",
			description = "Schlaegt ein veroeffentlichtes Projekt fuer die Top-10 vor (§3.11.1). "
					+ "Erlaubt fuer EDITOR und ADMIN. Der Body ist optional und traegt "
					+ "hoechstens einen unverbindlichen Platzvorschlag; ueber den Platz "
					+ "entscheidet die Administration beim Annehmen. Der Vorschlag allein "
					+ "aendert die Top-10 nicht.")
	@ApiResponse(responseCode = "201", description = "Die Nominierung ist angelegt und steht "
			+ "auf PENDING.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: proposedPosition liegt "
			+ "nicht zwischen 1 und 10.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist weder EDITOR "
			+ "noch ADMIN.")
	@ApiResponse(responseCode = "404", description = "PROJECT_NOT_FOUND: unter dieser ID gibt es "
			+ "kein Projekt.")
	@ApiResponse(responseCode = "409", description = "PROJECT_NOT_PUBLISHED, wenn das Projekt "
			+ "nicht veroeffentlicht ist; RESOURCE_IN_USE, wenn es bereits in der Top-10 steht "
			+ "oder schon eine offene Nominierung hat (§3.11.1).")
	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public Top10NominationResponse nominate(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Parameter(description = "ID des Projekts.")
			@PathVariable("projectId") UUID projectId,

			// Optional, weil das einzige Feld des Bodys optional ist: ohne
			// required = false endete eine Nominierung ohne Platzvorschlag mit
			// 400, und das waere ausgerechnet der einfachste Aufruf.
			@RequestBody(required = false) @Valid Top10NominationRequest request) {

		return nominationService.nominate(user, projectId,
				request == null ? Top10NominationRequest.empty() : request);
	}
}
