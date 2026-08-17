package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.user.User;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Eine Person in einer Projektantwort: Autor:in, zugewiesene:r Redakteur:in
 * oder Urheber:in eines Statusuebergangs (§6.1).
 *
 * <p>Enthaelt bewusst nur Name, ID und Profilbild. Weder {@code email} noch
 * {@code hsbEmail} gehoeren hier hinein: die HSB-Adresse verlaesst den Server
 * ueberhaupt nicht (§3.1), und die private Adresse ist die Login-Kennung, die
 * in einer oeffentlich lesbaren Projektliste nichts zu suchen hat. Ein eigenes
 * Record stellt das strukturell sicher; bei einer serialisierten Entity haengt
 * es an Annotationen, die man beim naechsten Feld vergisst.
 *
 * <p><strong>Das Profilbild haengt nicht am {@code User}, sondern am
 * {@code Portfolio}</strong> (§3.2). Es kann deshalb nicht aus der Entity
 * abgeleitet werden, sondern muss vom Aufrufer mitgegeben werden; wer es
 * nicht geladen hat, nutzt {@link #from(User)} und laesst das Feld leer.
 * Gefuellt wird es dort, wo eine Oberflaeche es zeigt, also an der
 * Projektkachel; ein Nachladen je Person waere das N+1-Verhalten, das der
 * Lesedienst gerade vermeidet.
 *
 * @param id        ID des Kontos, zugleich Filterwert von
 *                  {@code GET /api/projects?author={id}}
 * @param firstName Vorname
 * @param lastName  Nachname
 * @param avatarUrl Profilbild als Referenz {@code /api/files/{id}} (§3.15.1).
 *                  {@code null}, wenn keines hinterlegt ist oder der Aufrufer
 *                  es nicht geladen hat
 */
public record PersonResponse(
		UUID id,

		String firstName,

		String lastName,

		@Schema(description = "Profilbild als Referenz /api/files/{id} (§3.15.1). Kann fehlen: "
				+ "das Konto hat keines hinterlegt, oder die Antwort fuehrt es an dieser Stelle "
				+ "nicht mit. Gefuellt ist es an der Autor:in einer Projektkachel.",
				nullable = true)
		String avatarUrl) {

	/**
	 * Ohne Profilbild, fuer Antworten, die keines zeigen (Statusverlauf,
	 * Top-10-Protokoll, Nominierungen).
	 *
	 * @param user darf {@code null} sein, dann ist auch das Ergebnis {@code null}
	 */
	public static PersonResponse from(User user) {
		return from(user, null);
	}

	/**
	 * Mit Profilbild, fuer die Projektkachel.
	 *
	 * @param user      darf {@code null} sein, dann ist auch das Ergebnis
	 *                  {@code null}
	 * @param avatarUrl bereits geladene Referenz, {@code null} wenn keine
	 */
	public static PersonResponse from(User user, String avatarUrl) {
		if (user == null) {
			return null;
		}
		return new PersonResponse(user.getId(), user.getFirstName(), user.getLastName(),
				avatarUrl);
	}
}
