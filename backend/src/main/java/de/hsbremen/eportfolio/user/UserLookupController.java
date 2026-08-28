package de.hsbremen.eportfolio.user;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.user.dto.UserLookupResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die Nutzerauswahl aus API-Contract §6.1 (KAN-44).
 *
 * <p>Authentifiziert, aber ohne Rollenregel: jede angemeldete Person darf die
 * Liste abfragen, denn schon Studierende brauchen sie fuer die
 * Redaktionszuweisung bei der Projektanlage (§5, Fussnote 3). Der Pfad steht
 * nicht in den PUBLIC-Regeln der {@code SecurityConfig} und faellt damit unter
 * {@code anyRequest().authenticated()}: ohne Token 401
 * {@code NOT_AUTHENTICATED}.
 */
@RestController
@RequestMapping("/api/users")
@Tag(name = "Nutzerauswahl", description = "Schmale Personenliste fuer Auswahlfelder (§6.1). "
		+ "Nur ID und Name, nur aktive Konten, nur mit Token.")
public class UserLookupController {

	private final UserLookupService userLookupService;

	public UserLookupController(UserLookupService userLookupService) {
		this.userLookupService = userLookupService;
	}

	@Operation(summary = "Personen fuer ein Auswahlfeld suchen",
			description = "Aktive Konten, sortiert nach Nachname, ohne Paginierung. Je Eintrag "
					+ "ausschliesslich id, firstName und lastName; keine E-Mail-Adressen, der "
					+ "Endpoint ist kein Personenverzeichnis (§3.1, §6.1).")
	@ApiResponse(responseCode = "200", description = "Liste der Treffer, gegebenenfalls leer.")
	@ApiResponse(responseCode = "400", description = "Unbekannter Wert fuer role.")
	@ApiResponse(responseCode = "401", description = "Kein, abgelaufenes oder ungueltiges Token.")
	@GetMapping("/lookup")
	public List<UserLookupResponse> lookup(
			@Parameter(description = "Filter: nur Konten dieser Rollen (§2.1). Wiederholbar, "
					+ "mehrere Werte ODER-verknuepft, z. B. role=EDITOR&role=ADMIN fuer die "
					+ "Redaktionszuweisung (§5, Fussnote 3). Ohne Angabe alle Rollen.")
			@RequestParam(name = "role", required = false) List<Role> role,
			@Parameter(description = "Suchbegriff ueber Vor- und Nachname.")
			@RequestParam(name = "q", required = false) String q) {
		return userLookupService.lookup(role, q);
	}
}
