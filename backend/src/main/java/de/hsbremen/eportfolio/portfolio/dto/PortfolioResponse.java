package de.hsbremen.eportfolio.portfolio.dto;

import de.hsbremen.eportfolio.portfolio.Portfolio;
import de.hsbremen.eportfolio.project.dto.ProjectCardResponse;
import de.hsbremen.eportfolio.user.User;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;

/**
 * Das oeffentliche Profil einer Person: {@code GET /api/portfolios/{userId}}
 * (§6.1).
 *
 * <p><strong>Die Projektliste ist kein gespeichertes Feld</strong>, sondern das
 * Ergebnis einer Abfrage (§3.2): Projekte dieser Person im Status
 * {@code PUBLISHED}. Eine gespeicherte Liste muesste bei jedem Statuswechsel
 * eines Projekts nachgefuehrt werden und waere bei jedem uebersehenen Pfad
 * falsch; die Abfrage kann per Konstruktion nicht veralten.
 *
 * <p><strong>Nur eigene Projekte</strong>, also solche mit
 * {@code authorId = user}. Projekte, an denen die Person lediglich als Mitglied
 * mitgewirkt hat (§3.13), erscheinen nicht: §3.2 nennt die Abfrage woertlich.
 * Entscheidung aus der Klaerungsrunde zu KAN-22.
 *
 * <p><strong>Ohne Paginierung</strong>, weil §6.1 fuer diese Zeile eine schlichte
 * Liste fuehrt und kein Seitenformat nach §6.6. Ein Profil zeigt die Arbeiten
 * einer einzelnen Person; die Menge ist von der Sache her klein und wird auf der
 * Seite am Stueck dargestellt.
 *
 * <p>Fehlt die Portfolio-Zeile, bleiben {@code biography} und {@code avatarUrl}
 * leer, statt dass die Antwort scheitert. Nach §3.2.1 entsteht die Zeile
 * zusammen mit dem Benutzerkonto; die leeren Felder sind das Sicherheitsnetz
 * fuer Konten, die vor dieser Zusage angelegt wurden.
 *
 * @param user       Person, zu der dieses Profil gehoert
 * @param biography  Freitext, {@code null} solange nichts hinterlegt ist
 * @param avatarUrl  Profilbild, perspektivisch {@code avatarFileId} (§3.15)
 * @param projects   veroeffentlichte Projekte dieser Person
 */
public record PortfolioResponse(
		PortfolioUserResponse user,

		@Schema(description = "Freitext zur Person. Kann fehlen.", nullable = true)
		String biography,

		@Schema(description = "Profilbild. Kann fehlen; wird mit KAN-23 zu einer Datei-ID (§3.15).",
				nullable = true)
		String avatarUrl,

		@Schema(description = "Ausschliesslich veroeffentlichte Projekte dieser Person, per Abfrage "
				+ "ermittelt (§3.2). Neueste Veroeffentlichung zuerst.")
		List<ProjectCardResponse> projects) {

	/**
	 * Baut das Profil.
	 *
	 * @param user      Konto, dessen Profil abgerufen wurde
	 * @param portfolio zugehoerige Zeile, darf {@code null} sein (§3.2.1)
	 * @param projects  bereits abgebildete Kacheln der veroeffentlichten Projekte
	 */
	public static PortfolioResponse from(User user, Portfolio portfolio,
			List<ProjectCardResponse> projects) {

		return new PortfolioResponse(
				PortfolioUserResponse.from(user),
				portfolio == null ? null : portfolio.getBiography(),
				portfolio == null ? null : portfolio.getAvatarUrl(),
				projects);
	}
}
