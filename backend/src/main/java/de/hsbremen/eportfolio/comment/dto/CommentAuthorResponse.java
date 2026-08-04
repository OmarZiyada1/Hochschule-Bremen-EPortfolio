package de.hsbremen.eportfolio.comment.dto;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.user.User;
import java.util.UUID;

/**
 * Die Person, von der ein Kommentar stammt (§3.5, §6.1).
 *
 * <p><strong>Warum ein eigenes Record neben
 * {@code project.dto.PersonResponse}</strong>, das dieselben drei Namensfelder
 * traegt: hier kommt die {@code role} dazu. Sie wird gebraucht, weil ein
 * Kommentar ohne sie nicht einzuordnen ist. „Bitte die Quellenangaben
 * ergaenzen" ist eine Bitte unter Mitautor:innen oder eine Auflage der
 * Redaktion, und der Unterschied entscheidet darueber, was die Person am
 * Bildschirm als Naechstes tut. Aus dem Kommentartyp allein folgt er nicht:
 * {@code REPLY} schreiben beide Seiten (§2.3).
 *
 * <p>{@code PersonResponse} deshalb um ein Feld zu erweitern, waere der
 * schlechtere Weg: es steckt in jeder Projektkachel und in jedem
 * Historieneintrag, und die Rolle einer Person gehoert nicht in jede dieser
 * Antworten.
 *
 * <p>Wie dort gilt: weder {@code email} noch {@code hsbEmail} haben hier etwas
 * zu suchen (§3.1). Die Kommentarliste ist an einem veroeffentlichten Projekt
 * ohne Anmeldung lesbar.
 *
 * @param id        ID des Kontos
 * @param firstName Vorname
 * @param lastName  Nachname
 * @param role      Rolle im System (§2.1), damit erkennbar bleibt, ob die
 *                  Rueckmeldung aus der Redaktion kommt
 */
public record CommentAuthorResponse(
		UUID id,

		String firstName,

		String lastName,

		Role role) {

	/**
	 * @param user darf {@code null} sein, dann ist auch das Ergebnis
	 *             {@code null}. In der Datenbank ist {@code author_id} zwar
	 *             {@code not null} (§3.5); die Pruefung steht hier trotzdem,
	 *             damit die Abbildung fuer sich genommen vollstaendig ist
	 */
	public static CommentAuthorResponse from(User user) {
		if (user == null) {
			return null;
		}
		return new CommentAuthorResponse(user.getId(), user.getFirstName(), user.getLastName(),
				user.getRole());
	}
}
