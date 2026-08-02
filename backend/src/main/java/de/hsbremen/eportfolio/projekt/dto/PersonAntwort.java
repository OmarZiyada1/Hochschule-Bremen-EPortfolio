package de.hsbremen.eportfolio.projekt.dto;

import de.hsbremen.eportfolio.benutzer.User;
import java.util.UUID;

/**
 * Eine Person in einer Projektantwort: Autor:in, zugewiesene:r Redakteur:in
 * oder Urheber:in eines Statusuebergangs (§6.1).
 *
 * <p>Enthaelt bewusst nur Name und ID. Weder {@code email} noch {@code hsbEmail}
 * gehoeren hier hinein: die HSB-Adresse verlaesst den Server ueberhaupt nicht
 * (§3.1), und die private Adresse ist die Login-Kennung, die in einer
 * oeffentlich lesbaren Projektliste nichts zu suchen hat. Ein eigenes Record
 * stellt das strukturell sicher; bei einer serialisierten Entity haengt es an
 * Annotationen, die man beim naechsten Feld vergisst.
 *
 * @param id       ID des Kontos, zugleich Filterwert von
 *                 {@code GET /api/projekte?autor={id}}
 * @param vorname  Vorname
 * @param nachname Nachname
 */
public record PersonAntwort(
		UUID id,

		String vorname,

		String nachname) {

	/**
	 * @param user darf {@code null} sein, dann ist auch das Ergebnis {@code null}
	 */
	public static PersonAntwort aus(User user) {
		if (user == null) {
			return null;
		}
		return new PersonAntwort(user.getId(), user.getVorname(), user.getNachname());
	}
}
