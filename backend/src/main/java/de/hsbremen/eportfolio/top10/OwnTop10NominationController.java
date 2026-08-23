package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.top10.dto.Top10NominationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die eigenen Top-10-Vorschlaege der Redaktion aus API-Contract §6.1 (KAN-37,
 * Contract v68).
 *
 * <p><strong>Warum der Pfad nicht unter {@code /api/admin/} liegt.</strong> Er
 * gehoert der Redaktion und nicht der Administration: eine Redakteur:in soll
 * sehen, was sie selbst vorgeschlagen hat und ob darueber entschieden wurde.
 * Unter {@code /api/admin/} ginge das nicht, weil {@code SecurityConfig} diesen
 * Praefix pauschal auf {@code hasRole("ADMIN")} fuehrt. Der Zuschnitt folgt
 * {@code GET /api/projects?editor=me}: dieselbe Ressource, auf die eigene
 * Person eingegrenzt. Der vollstaendige Spiegel bleibt
 * {@code GET /api/admin/top10-nominations}.
 *
 * <p><strong>Ein eigener Controller und keine Zeile im
 * {@link Top10Controller}.</strong> Der traegt {@code @SecurityRequirements},
 * hebt die Token-Anforderung also fuer alle seine Methoden auf; dieser Pfad
 * verlangt sie. Ausserdem ist der Klassenpfad ein anderer.
 *
 * <p><strong>Zur Freigabe in {@code SecurityConfig}:</strong> dort steht
 * {@code /api/top10} als exaktes Muster und nicht als {@code /api/top10/**},
 * dieser Pfad faellt also unter {@code anyRequest().authenticated()} und ergibt
 * ohne Token 401, wie §5 es verlangt. Die Rollenpruefung liegt im Dienst, weil
 * eine Regel in der Filterkette den Unterschied zwischen 400 (falscher
 * Parameter) und 403 (falsche Rolle) nicht treffen koennte.
 */
@RestController
@RequestMapping("/api/top10-nominations")
@Tag(name = "Top-10", description = "Die kuratierte Auswahl der Startseite (§3.11). Ohne Token "
		+ "abrufbar; kuratiert wird sie ausschliesslich ueber die Administrationsseite.")
public class OwnTop10NominationController {

	private final Top10NominationService nominationService;

	public OwnTop10NominationController(Top10NominationService nominationService) {
		this.nominationService = nominationService;
	}

	@Operation(summary = "Eigene Nominierungen lesen",
			description = "Die Vorschlaege der angemeldeten Person, neueste zuerst, offene wie "
					+ "entschiedene (§3.11). Ohne Paginierung, wie beim Admin-Spiegel. Der "
					+ "Parameter \"nominatedBy\" ist Pflicht und laesst allein den Wert \"me\" "
					+ "zu: er ist der Zuschnitt der Ressource und kein Filter. Wer fremde "
					+ "Vorschlaege lesen darf, nimmt GET /api/admin/top10-nominations.")
	@ApiResponse(responseCode = "200", description = "Die eigenen Nominierungen.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: \"nominatedBy\" fehlt "
			+ "oder nennt etwas anderes als \"me\"; oder \"status\" ist kein Wert aus §2.8.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist weder EDITOR "
			+ "noch ADMIN.")
	@GetMapping
	public List<Top10NominationResponse> ownNominations(
			@AuthenticationPrincipal AuthenticatedUser user,

			// required = true an der OpenAPI-Beschreibung, required = false an der
			// Bindung: §6.1 fuehrt den Parameter als Pflicht, und genau das soll im
			// erzeugten Dokument stehen. Die Bindung bleibt trotzdem optional,
			// damit ein fehlender Parameter nicht als Spring-Bindungsfehler endet,
			// sondern als 400 VALIDATION_FAILED mit der Meldung aus
			// requireOwnScope, die den zulaessigen Wert nennt.
			@Parameter(description = "Pflichtparameter, einziger zulaessiger Wert \"me\".",
					example = "me", required = true)
			@RequestParam(name = "nominatedBy", required = false) String nominatedBy,

			@Parameter(description = "Optionaler Filter auf den Stand der Nominierung (§2.8). "
					+ "Ohne Angabe kommen alle.")
			@RequestParam(name = "status", required = false) NominationStatus status) {

		return nominationService.ownNominations(user, nominatedBy, status);
	}
}
