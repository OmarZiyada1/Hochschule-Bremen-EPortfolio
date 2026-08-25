package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.project.ProjectMember;
import de.hsbremen.eportfolio.user.User;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Projektmitglied in {@code ProjectDetailResponse} und, seit Contract v78,
 * auch in {@code ProjectCardResponse} (§3.13).
 *
 * <p>Nach aussen traegt das Mitglied die {@code userId} und nicht die ID der
 * Zuordnungszeile: fuer das Frontend ist die Person die Identitaet (Verlinkung
 * auf ihr Portfolio, Vergleich mit dem angemeldeten Konto), die Zuordnungszeile
 * ist reine Persistenz. Die Mitgliederliste wird ohnehin nicht einzeln
 * adressiert, sondern eingebettet ueber {@code POST}/{@code PUT /projects}
 * gepflegt (§3.13.1).
 *
 * <p><strong>Das Profilbild haengt nicht am {@code User}, sondern am
 * {@code Portfolio}</strong> (§3.2), genau wie bei {@link PersonResponse}. Es
 * laesst sich deshalb nicht aus der Zuordnungszeile ableiten, sondern muss vom
 * Aufrufer mitgegeben werden; wer es nicht geladen hat, nutzt
 * {@link #from(ProjectMember)} und laesst das Feld leer. Gefuellt wird es dort,
 * wo eine Oberflaeche es zeigt, also an der Projektkachel; ein Nachladen je
 * Mitglied waere das N+1-Verhalten, das der Lesedienst gerade vermeidet.
 *
 * @param userId      Konto des Mitglieds
 * @param firstName   Vorname
 * @param lastName    Nachname
 * @param avatarUrl   Profilbild als Referenz {@code /api/files/{id}} (§3.15.1).
 *                    {@code null}, wenn keines hinterlegt ist oder der Aufrufer
 *                    es nicht geladen hat
 * @param projectRole freie Funktionsbezeichnung, seit Contract v65 freiwillig
 *                    und deshalb moeglicherweise {@code null}; das ist
 *                    <em>nicht</em> die System-Rolle aus §2.1
 */
public record MemberResponse(
		UUID userId,

		String firstName,

		String lastName,

		@Schema(description = "Profilbild als Referenz /api/files/{id} (§3.15.1). Kann fehlen: "
				+ "das Konto hat keines hinterlegt, oder die Antwort fuehrt es an dieser Stelle "
				+ "nicht mit. Gefuellt ist es an den Mitgliedern einer Projektkachel.",
				nullable = true)
		String avatarUrl,

		@Schema(description = "Freie Funktionsbezeichnung im Projekt, z. B. \"Frontend\". "
				+ "Nicht die System-Rolle aus §2.1. Freiwillig seit Contract v65: "
				+ "sie kann spaeter eingetragen werden, und die Autor:in traegt "
				+ "anfangs keine.",
				example = "Frontend",
				nullable = true,
				requiredMode = Schema.RequiredMode.NOT_REQUIRED)
		String projectRole) {

	/**
	 * Ohne Profilbild, fuer Antworten, die keines zeigen (die Mitgliederliste
	 * der Detailantwort, die wie ihre Autor:in ohne Bild auskommt).
	 */
	public static MemberResponse from(ProjectMember member) {
		return from(member, null);
	}

	/**
	 * Mit Profilbild, fuer die Projektkachel (§3.13, Contract v78).
	 *
	 * @param avatarUrl bereits geladene Referenz, {@code null} wenn keine
	 */
	public static MemberResponse from(ProjectMember member, String avatarUrl) {
		User user = member.getUser();
		return new MemberResponse(
				user == null ? null : user.getId(),
				user == null ? null : user.getFirstName(),
				user == null ? null : user.getLastName(),
				avatarUrl,
				member.getProjectRole());
	}
}
