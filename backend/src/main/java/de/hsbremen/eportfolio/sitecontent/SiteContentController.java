package de.hsbremen.eportfolio.sitecontent;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.sitecontent.dto.SiteContentResponse;
import de.hsbremen.eportfolio.sitecontent.dto.SiteContentUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die beiden Endpoints der Startseitentexte aus §6.1: das oeffentliche Lesen
 * unter {@code /api/site-content} und das Pflegen unter
 * {@code /api/admin/site-content}.
 *
 * <p><strong>Beide in einer Klasse</strong>, anders als bei den Stammdaten, wo
 * {@code MasterDataController} und {@code MasterDataAdminController} getrennt
 * sind. Dort trennt der Schnitt eine PUBLIC-Leseklasse mit fuenf Methoden von
 * einer ADMIN-Schreibklasse mit vierzehn, und die Token-Anforderung liesse sich
 * nur noch je Methode ausdruecken. Hier sind es genau zwei Methoden, die
 * dieselbe Ressource lesen und schreiben; die Aufhebung der Token-Anforderung
 * steht deshalb an der einen Methode, die sie braucht, und nicht an der Klasse.
 *
 * <p><strong>Die Rollenebene liegt in der Filterkette</strong>, wie beim
 * {@code MasterDataAdminController}: {@code SecurityConfig} fuehrt
 * {@code /api/admin/**} mit {@code hasRole("ADMIN")}, und der Lesepfad
 * {@code GET /api/site-content} steht dort in derselben Zeile wie die uebrigen
 * PUBLIC-GETs. Der {@link SiteContentService} prueft
 * {@code mayManageSiteContent} trotzdem noch einmal (§5).
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Startseitentexte", description = "Die von der Administration gepflegten Texte der "
		+ "oeffentlichen Startseite (§6.1). Gelesen ohne Token, gepflegt ausschliesslich von "
		+ "ADMIN. Was hier nicht gepflegt ist, zeigt das Frontend aus seinen eigenen "
		+ "Sprachdateien.")
public class SiteContentController {

	private final SiteContentService siteContentService;

	public SiteContentController(SiteContentService siteContentService) {
		this.siteContentService = siteContentService;
	}

	@Operation(summary = "Startseitentexte lesen",
			description = "Alle gepflegten Textstellen der Startseite, deutsch und englisch in "
					+ "einer Antwort. Ein Schluessel erscheint, sobald mindestens eine Sprache "
					+ "gepflegt ist; die ungepflegte steht dann als null. Ungepflegte "
					+ "Schluessel fehlen ganz, dort gilt die Sprachdatei des Frontends. "
					+ "Solange nichts gepflegt ist, ist die Liste leer.")
	@ApiResponse(responseCode = "200", description = "Die gepflegten Textstellen.")
	// Kein Bearer-Token noetig. Hebt die global in OpenApiConfig registrierte
	// Anforderung fuer genau diese Methode auf, damit die Swagger-UI hier kein
	// Schloss anzeigt und nicht suggeriert, man muesse sich erst anmelden. Am
	// PUT darunter bleibt sie stehen.
	@SecurityRequirements
	@GetMapping("/site-content")
	public SiteContentResponse siteContent() {
		return siteContentService.read();
	}

	@Operation(summary = "Startseitentexte pflegen",
			description = "Ersetzt die uebergebenen Schluessel vollstaendig und laesst alle "
					+ "uebrigen unberuehrt. Ein leerer Wert loescht die Fassung dieser Sprache; "
					+ "die Stelle faellt damit auf die Sprachdatei des Frontends zurueck. Die "
					+ "Antwort ist der neue Gesamtstand, also dieselbe Form wie beim Lesen.")
	@ApiResponse(responseCode = "200", description = "Der neue Gesamtstand.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: unbekannter oder "
			+ "doppelter Schluessel, fehlender oder ueberzaehliger Platzhalter, zu langer Text.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rolle ist nicht ADMIN.")
	@PutMapping("/admin/site-content")
	public SiteContentResponse replaceSiteContent(
			@AuthenticationPrincipal AuthenticatedUser user,
			@RequestBody @Valid SiteContentUpdateRequest request) {

		return siteContentService.replace(user, request);
	}
}
