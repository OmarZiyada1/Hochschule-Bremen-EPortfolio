package de.hsbremen.eportfolio.projekt.dto;

import de.hsbremen.eportfolio.benutzer.User;
import de.hsbremen.eportfolio.projekt.Projektmitglied;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Projektmitglied in {@code ProjektDetailAntwort} (§3.13).
 *
 * <p>Nach aussen traegt das Mitglied die {@code userId} und nicht die ID der
 * Zuordnungszeile: fuer das Frontend ist die Person die Identitaet (Verlinkung
 * auf ihr Portfolio, Vergleich mit dem angemeldeten Konto), die Zuordnungszeile
 * ist reine Persistenz. Die Mitgliederliste wird ohnehin nicht einzeln
 * adressiert, sondern eingebettet ueber {@code POST}/{@code PUT /projekte}
 * gepflegt (§3.13.1).
 *
 * @param userId        Konto des Mitglieds
 * @param vorname       Vorname
 * @param nachname      Nachname
 * @param rolleImProjekt freie Funktionsbezeichnung, z. B. „Frontend"; das ist
 *                       <em>nicht</em> die System-Rolle aus §2.1
 */
public record MitgliedAntwort(
		UUID userId,

		String vorname,

		String nachname,

		@Schema(description = "Freie Funktionsbezeichnung im Projekt, z. B. \"Frontend\". "
				+ "Nicht die System-Rolle aus §2.1.", example = "Frontend")
		String rolleImProjekt) {

	public static MitgliedAntwort aus(Projektmitglied mitglied) {
		User user = mitglied.getUser();
		return new MitgliedAntwort(
				user == null ? null : user.getId(),
				user == null ? null : user.getVorname(),
				user == null ? null : user.getNachname(),
				mitglied.getRolleImProjekt());
	}
}
