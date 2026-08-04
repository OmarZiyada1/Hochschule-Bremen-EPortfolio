package de.hsbremen.eportfolio.portfolio.dto;

import de.hsbremen.eportfolio.user.User;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Der Kopf des oeffentlichen Profils: die Person, zu der das Portfolio gehoert
 * (§6.1, Zeile {@code GET /portfolios/{userId}}).
 *
 * <p><strong>Warum hier die E-Mail steht</strong>, anders als in
 * {@code project/dto/PersonResponse}: §3.2 nimmt die private Adresse
 * ausdruecklich in das oeffentliche Profil auf. Ein Portfolio-Portal soll
 * Arbeiten sichtbar machen und Kontaktaufnahme ermoeglichen; ein Profil ohne
 * Rueckkanal erfuellt diesen Zweck nur halb. Die Adresse ist bewusst die
 * private und nicht die dienstliche, weil sie frei waehlbar ist und nach der
 * Exmatrikulation bestehen bleibt (§3.1.1). Der Preis ist im Contract offen
 * benannt: eine oeffentlich abrufbare Adresse ist maschinell einsammelbar, und
 * die betroffene Person kann das derzeit nicht abwaehlen (offener Punkt 11).
 *
 * <p><strong>{@code hsbEmail} steht hier nicht</strong>, ohne Ausnahme. Sie ist
 * ein internes Nachweismerkmal und erscheint ausschliesslich in der
 * Admin-Nutzerverwaltung (§3.1). Ein eigenes Record stellt das strukturell
 * sicher; bei einer serialisierten Entity haenge es an Annotationen, die man
 * beim naechsten Feld vergisst. Ein Test belegt es fuer diesen Endpoint.
 *
 * <p><strong>Warum nicht {@code PersonResponse} wiederverwendet wird:</strong>
 * jenes Record traegt bewusst keine Adresse, weil es in Projektlisten steckt.
 * Beide um ein optionales Feld zusammenzulegen hiesse, dass die Adresse
 * kuenftig ueber jede Projektantwort mitliefe, sobald jemand es fuellt.
 *
 * @param id        ID des Kontos, zugleich Filterwert von
 *                  {@code GET /api/projects?author={id}}
 * @param firstName Vorname
 * @param lastName  Nachname
 * @param email     private E-Mail als Kontaktweg (§3.2)
 */
public record PortfolioUserResponse(
		UUID id,

		String firstName,

		String lastName,

		@Schema(description = "Private E-Mail als Kontaktweg des oeffentlichen Profils (§3.2). "
				+ "Die HSB-Adresse erscheint hier nie.", example = "vorname.nachname@example.org")
		String email) {

	public static PortfolioUserResponse from(User user) {
		return new PortfolioUserResponse(
				user.getId(),
				user.getFirstName(),
				user.getLastName(),
				user.getEmail());
	}
}
