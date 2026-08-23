package de.hsbremen.eportfolio.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Ein Projektmitglied beim Anlegen und Aendern eines Projekts (§3.13, §3.13.1).
 * Gegenstueck zu {@link MemberResponse}.
 *
 * <p>Die Mitgliederliste hat bewusst keinen eigenen Endpoint, sie wird
 * eingebettet ueber {@code POST /projects} und {@code PUT /projects/{id}}
 * gepflegt (§3.13.1). Adressiert wird deshalb die Person und nicht die
 * Zuordnungszeile: der Client kennt Personen, die Zeile ist reine Persistenz.
 *
 * @param userId      Konto des Mitglieds. Muss existieren, sonst
 *                    <strong>400</strong>. Die Autor:in steht in
 *                    {@code Project.authorId} und ist kein Mitglied
 *                    (§3.13.1); ihre ID hier ergibt ebenfalls 400. Ihre
 *                    Funktionsbezeichnung traegt {@code authorRole} am
 *                    Projekt (§3.3 seit Contract v66).
 * @param projectRole freie Funktionsbezeichnung, z. B. „Frontend"; das ist
 *                    <em>nicht</em> die System-Rolle aus §2.1. Seit Contract
 *                    v65 freiwillig: sie kann spaeter eingetragen werden
 */
public record MemberRequest(
		@Schema(description = "ID des Kontos aus GET /api/users/lookup.")
		@NotNull(message = "userId fehlt.")
		UUID userId,

		@Schema(description = "Freie Funktionsbezeichnung im Projekt, z. B. \"Frontend\". "
				+ "Nicht die System-Rolle aus §2.1. Freiwillig seit Contract v65.",
				example = "Frontend")
		@Size(max = 255, message = "projectRole ist zu lang (hoechstens 255 Zeichen).")
		String projectRole) {
}
