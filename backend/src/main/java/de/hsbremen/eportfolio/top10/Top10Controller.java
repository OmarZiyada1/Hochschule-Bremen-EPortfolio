package de.hsbremen.eportfolio.top10;

import de.hsbremen.eportfolio.top10.dto.Top10EntryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die oeffentliche Top-10 aus API-Contract §6.1 (KAN-24).
 *
 * <p>PUBLIC nach §5, in {@code SecurityConfig} schon vor diesem Controller als
 * GET-Pfad freigegeben. Die Regel stand dort vorab, damit der Endpoint nicht
 * versehentlich hinter {@code anyRequest().authenticated()} landet.
 *
 * <p><strong>Ohne Paginierung</strong> und damit ohne {@code PageResponse}: die
 * Liste hat hoechstens zehn Eintraege. §6.1 fuehrt sie im selben Abschnitt wie
 * die Stammdaten, fuer die dieselbe Ueberlegung gilt.
 *
 * <p>Der Controller bleibt duenn: Dienst rufen, fertig. Was ein nicht
 * angemeldeter Aufrufer zu sehen bekommt, entscheidet der {@link Top10Service}.
 */
@RestController
@RequestMapping("/api/top10")
@Tag(name = "Top-10", description = "Die kuratierte Auswahl der Startseite (§3.11). Ohne Token "
		+ "abrufbar; kuratiert wird sie ausschliesslich ueber die Administrationsseite.")
// Kein Bearer-Token noetig, wie beim MasterDataController: hebt die global in
// OpenApiConfig registrierte Anforderung auf, damit die Swagger-UI hier kein
// Schloss anzeigt.
@SecurityRequirements
public class Top10Controller {

	private final Top10Service top10Service;

	public Top10Controller(Top10Service top10Service) {
		this.top10Service = top10Service;
	}

	@Operation(summary = "Top-10 lesen",
			description = "Die kuratierte Liste, aufsteigend nach Platz. Je Eintrag stehen "
					+ "position, addedAt und die Projektkachel (§6.1). Enthalten sind nur "
					+ "Eintraege zu veroeffentlichten Projekten; ein zurueckgezogenes Projekt "
					+ "raeumt seinen Platz. Der frei gewordene Platz wird nicht durch "
					+ "Nachruecken geschlossen, die Liste kann also Luecken haben und weniger "
					+ "als zehn Eintraege enthalten. Unbesetzte Plaetze stellt die Oberflaeche "
					+ "als Platzhalter dar.")
	@ApiResponse(responseCode = "200", description = "Die Top-10, geordnet nach Platz. Leer, "
			+ "solange nichts kuratiert wurde.")
	@GetMapping
	public List<Top10EntryResponse> list() {
		return top10Service.list();
	}
}
