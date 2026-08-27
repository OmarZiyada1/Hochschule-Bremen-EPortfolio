package de.hsbremen.eportfolio.portfolio;

import de.hsbremen.eportfolio.auth.AuthenticatedUser;
import de.hsbremen.eportfolio.portfolio.dto.OwnPortfolioResponse;
import de.hsbremen.eportfolio.portfolio.dto.PortfolioResponse;
import de.hsbremen.eportfolio.portfolio.dto.PortfolioUpdateRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Die drei Portfolio-Endpoints aus API-Contract §6.1 (KAN-22).
 *
 * <p><strong>Zwei Pfade, die sich nur im Plural unterscheiden.</strong>
 * {@code /api/portfolios/{userId}} ist das oeffentliche Profil einer beliebigen
 * Person, {@code /api/portfolio/me} das eigene. So steht es im Contract, und der
 * Unterschied ist kein Schoenheitsfehler: der erste Pfad adressiert eine
 * Ressource aus einer Sammlung, der zweite eine, die es je angemeldeter Person
 * genau einmal gibt und die deshalb keine ID im Pfad braucht. Eine
 * {@code @RequestMapping} auf Klassenebene gibt es hier folglich nicht; sie
 * koennte nur einen der beiden Pfade tragen.
 *
 * <p><strong>Zur Freigabe in {@code SecurityConfig}:</strong>
 * {@code GET /api/portfolios/*} steht dort seit KAN-5 als PUBLIC-Pfad, weil §5
 * das oeffentliche Profil ohne Anmeldung lesbar macht. Ohne Token ist
 * {@code @AuthenticationPrincipal} {@code null}, was diesen Endpoint nicht
 * stoert: er wertet die anfragende Person gar nicht aus. Die beiden
 * {@code /me}-Pfade sind von der Freigabe nicht erfasst und fallen unter
 * {@code anyRequest().authenticated()}, ergeben ohne Token also 401.
 *
 * <p>Der Controller bleibt duenn: Parameter binden, Dienst rufen. Anlage,
 * Rechte und Fehlerpolitik liegen im {@link PortfolioService}.
 */
@RestController
@RequestMapping("/api")
@Tag(name = "Portfolio", description = "Das oeffentliche Profil einer Person und die Pflege des "
		+ "eigenen (§3.2, §6.1). Die Projektliste des Profils ist nicht gespeichert, sondern eine "
		+ "Abfrage auf die veroeffentlichten Projekte der Person.")
public class PortfolioController {

	private final PortfolioService portfolioService;

	public PortfolioController(PortfolioService portfolioService) {
		this.portfolioService = portfolioService;
	}

	/**
	 * Das oeffentliche Profil einer Person, auch ohne Anmeldung.
	 *
	 * <p>Der einzige Fehlerfall ist die unbekannte Benutzer-ID. Eine fehlende
	 * Portfolio-Zeile ist keiner: sie ergibt leere Felder (§3.2.1).
	 */
	@Operation(summary = "Oeffentliches Profil lesen",
			description = "Person, Biografie, Avatar und die veroeffentlichten Projekte dieser "
					+ "Person (§6.1). Frei zugaenglich, weil §5 veroeffentlichte Inhalte fuer alle "
					+ "lesbar macht. Die Antwort enthaelt die private E-Mail als Kontaktweg (§3.2), "
					+ "niemals die HSB-Adresse (§3.1). Aufgefuehrt werden ausschliesslich Projekte "
					+ "im Status PUBLISHED, an denen diese Person beteiligt ist: als Autor:in oder "
					+ "als Projektmitglied (§3.13). Seit Contract v84 zaehlt die Mitgliedschaft "
					+ "mit; bis v83 tat sie es nicht.")
	@ApiResponse(responseCode = "200", description = "Das Profil. Biografie und Avatar koennen leer "
			+ "sein, die Projektliste kann leer sein.")
	@ApiResponse(responseCode = "404", description = "RESOURCE_NOT_FOUND: unter dieser ID gibt es "
			+ "kein Konto.")
	@GetMapping("/portfolios/{userId}")
	public PortfolioResponse publicProfile(
			@Parameter(description = "ID des Kontos, zu dem das Profil gehoert.")
			@PathVariable("userId") UUID userId) {

		return portfolioService.publicProfile(userId);
	}

	/**
	 * Das eigene Profil.
	 *
	 * <p>Antwortet auch dann mit 200, wenn es noch keine Portfolio-Zeile gibt
	 * (§3.2.1). Der Client bekommt dann leere Felder und zeigt das Formular an,
	 * statt eine Fehlerseite zu melden.
	 */
	@Operation(summary = "Eigenes Profil lesen",
			description = "Biografie und Avatar der angemeldeten Person, dazu mayEditPortfolio aus "
					+ "der Rechtematrix (§5). Fehlt die Portfolio-Zeile, ist die Antwort 200 mit "
					+ "leeren Feldern und kein 404 (§3.2.1).")
	@ApiResponse(responseCode = "200", description = "Das eigene Profil, gegebenenfalls leer.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@GetMapping("/portfolio/me")
	public OwnPortfolioResponse own(@AuthenticationPrincipal AuthenticatedUser user) {
		return portfolioService.own(user);
	}

	/**
	 * Das eigene Profil aendern.
	 *
	 * <p>Legt die Zeile bei Bedarf an, damit auf ein GET mit 200 kein PUT mit 404
	 * folgen kann (§3.2.1).
	 */
	@Operation(summary = "Eigenes Profil aendern",
			description = "Ersetzt Biografie und Avatar durch den Inhalt des Bodys. Ein "
					+ "weggelassenes Feld leert den bisherigen Wert; das ist die Bedeutung von PUT "
					+ "(§6.3). Existiert noch keine Portfolio-Zeile, legt der Aufruf sie an. "
					+ "Betroffen ist ausschliesslich das eigene Profil: ein fremdes laesst sich "
					+ "ueber diesen Pfad gar nicht adressieren (§5).")
	@ApiResponse(responseCode = "200", description = "Das geaenderte Profil.")
	@ApiResponse(responseCode = "400", description = "VALIDATION_FAILED: biography oder avatarUrl "
			+ "ueberschreiten die zulaessige Laenge.")
	@ApiResponse(responseCode = "401", description = "Kein gueltiges Token mitgeschickt.")
	@ApiResponse(responseCode = "403", description = "NO_PERMISSION: die Rechtematrix laesst die "
			+ "Bearbeitung derzeit nicht zu.")
	@PutMapping("/portfolio/me")
	public OwnPortfolioResponse update(
			@AuthenticationPrincipal AuthenticatedUser user,

			@Valid @RequestBody PortfolioUpdateRequest request) {

		return portfolioService.update(user, request);
	}
}
