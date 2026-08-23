package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.project.ProjectMember;
import de.hsbremen.eportfolio.user.User;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Projektmitglied in {@code ProjectDetailResponse} (§3.13).
 *
 * <p>Nach aussen traegt das Mitglied die {@code userId} und nicht die ID der
 * Zuordnungszeile: fuer das Frontend ist die Person die Identitaet (Verlinkung
 * auf ihr Portfolio, Vergleich mit dem angemeldeten Konto), die Zuordnungszeile
 * ist reine Persistenz. Die Mitgliederliste wird ohnehin nicht einzeln
 * adressiert, sondern eingebettet ueber {@code POST}/{@code PUT /projects}
 * gepflegt (§3.13.1).
 *
 * @param userId      Konto des Mitglieds
 * @param firstName   Vorname
 * @param lastName    Nachname
 * @param projectRole freie Funktionsbezeichnung, seit Contract v65 freiwillig
 *                    und deshalb moeglicherweise {@code null}; das ist
 *                    <em>nicht</em> die System-Rolle aus §2.1
 */
public record MemberResponse(
		UUID userId,

		String firstName,

		String lastName,

		@Schema(description = "Freie Funktionsbezeichnung im Projekt, z. B. \"Frontend\". "
				+ "Nicht die System-Rolle aus §2.1. Freiwillig seit Contract v65: "
				+ "sie kann spaeter eingetragen werden, und die Autor:in traegt "
				+ "anfangs keine.",
				example = "Frontend",
				nullable = true,
				requiredMode = Schema.RequiredMode.NOT_REQUIRED)
		String projectRole) {

	public static MemberResponse from(ProjectMember member) {
		User user = member.getUser();
		return new MemberResponse(
				user == null ? null : user.getId(),
				user == null ? null : user.getFirstName(),
				user == null ? null : user.getLastName(),
				member.getProjectRole());
	}
}
