package de.hsbremen.eportfolio.portfolio.dto;

import de.hsbremen.eportfolio.portfolio.Portfolio;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Das eigene Profil: {@code GET /api/portfolio/me} und die Antwort auf
 * {@code PUT /api/portfolio/me} (§6.1).
 *
 * <p><strong>Warum ein eigenes Record neben {@link PortfolioResponse}:</strong>
 * die beiden Endpoints beantworten verschiedene Fragen. Das oeffentliche Profil
 * stellt eine Person mit ihren Arbeiten dar, dieses hier liefert die
 * Bearbeitungsmaske ihres Besitzers. Person und Projektliste stehen deshalb
 * nicht darin: wer angemeldet ist, weiss aus {@code GET /api/auth/me}, wer er
 * ist, und seine Projekte holt er ueber {@code GET /api/projects?author=…} in
 * dem Umfang, den §5 ihm zugesteht. Ein gemeinsames Record muesste beide Faelle
 * mit halbleeren Feldern bedienen.
 *
 * <p>Bei fehlender Portfolio-Zeile sind beide Inhaltsfelder {@code null} und die
 * Antwort trotzdem 200 (§3.2.1). Ein 404 waere hier die falsche Auskunft: das
 * Profil einer angemeldeten Person gibt es, es ist nur noch leer.
 *
 * @param biography       Freitext, {@code null} solange nichts hinterlegt ist
 * @param avatarUrl       Profilbild, perspektivisch {@code avatarFileId} (§3.15)
 * @param mayEditPortfolio ob die angemeldete Person dieses Profil aendern darf
 */
public record OwnPortfolioResponse(
		@Schema(description = "Freitext zur eigenen Person. Kann fehlen.", nullable = true)
		String biography,

		@Schema(description = "Eigenes Profilbild. Kann fehlen; wird mit KAN-23 zu einer Datei-ID "
				+ "(§3.15).", nullable = true)
		String avatarUrl,

		@Schema(description = "Ob dieses Profil bearbeitet werden darf (§5, Zeile \"Eigenes "
				+ "Portfolio bearbeiten\"). Heute fuer jede angemeldete Person true; mit der "
				+ "erzwungenen Passwortaenderung aus §6.7 kann der Wert false werden.",
				example = "true")
		boolean mayEditPortfolio) {

	/**
	 * Baut die Antwort.
	 *
	 * @param portfolio        eigene Zeile, darf {@code null} sein (§3.2.1)
	 * @param mayEditPortfolio Ergebnis von
	 *                         {@code ProjectPermissionService.mayEditPortfolio}
	 */
	public static OwnPortfolioResponse from(Portfolio portfolio, boolean mayEditPortfolio) {
		return new OwnPortfolioResponse(
				portfolio == null ? null : portfolio.getBiography(),
				portfolio == null ? null : portfolio.getAvatarUrl(),
				mayEditPortfolio);
	}
}
