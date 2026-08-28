package de.hsbremen.eportfolio.user.dto;

import de.hsbremen.eportfolio.user.User;
import java.util.UUID;

/**
 * Die schlanke Personenform des Projekts: ID und Name, sonst nichts.
 *
 * <p>Entstanden als Eintrag der Auswahlliste von {@code GET /api/users/lookup}
 * (§6.1, KAN-44) und seit Contract v88 zusaetzlich das Feld
 * {@code handledBy} der Support-Anfrage (§3.20). Dort dieselben drei Felder
 * ein weiteres Mal zu schreiben waere neben {@code project.dto.PersonResponse}
 * die dritte Abschrift derselben Form gewesen; jene traegt zusaetzlich das
 * Profilbild und haengt am Portfolio (§3.2), das hier niemand braucht.
 *
 * <p>Bewusst nur diese drei Felder und kein Feld mehr. Die Liste versorgt
 * Personenfelder wie die Redaktionszuweisung bei der Projektanlage (§5,
 * Fussnote 3); dafuer braucht es Namen und ID, sonst nichts. Insbesondere
 * keine der beiden E-Mail-Adressen: {@code hsbEmail} fremder Konten erscheint
 * ausserhalb der Admin-User-Verwaltung in keiner Response (§3.1; die eigene
 * fuehren seit v50 nur die Auth-Antworten), und die private Adresse ist
 * die Login-Kennung, die dieser fuer alle Angemeldeten erreichbare Endpoint
 * nicht verbreiten darf. Ein Test belegt, dass keine Adresse in der Antwort
 * vorkommt.
 */
public record UserLookupResponse(
		UUID id,
		String firstName,
		String lastName) {

	public static UserLookupResponse from(User user) {
		return new UserLookupResponse(
				user.getId(),
				user.getFirstName(),
				user.getLastName());
	}
}
