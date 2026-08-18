package de.hsbremen.eportfolio.admin.dto;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import de.hsbremen.eportfolio.user.User;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * Ein Konto in der Antwort der Nutzerverwaltung (§6.1, §3.1).
 *
 * <p><strong>Der einzige Ort, an dem {@code hsbEmail} fremder Konten den
 * Server verlaesst.</strong> §3.1 nennt dafuer {@code GET /api/admin/users}
 * und {@code GET /api/admin/users/{id}}; die eigene Adresse steht seit v50
 * zusaetzlich in den Auth-Antworten an die Person selbst (KAN-69). Jeder
 * andere Kontext bleibt ausgeschlossen. Die Admin-Ausnahme besteht, weil ein
 * Admin die Hochschulzugehoerigkeit sehen muss, um ein Konto zu beurteilen: sie
 * ist genau das Merkmal, an dem sich das Konto als legitim erweist, und eine
 * Rollenzuweisung ohne diese Information waere eine Entscheidung ins Blaue.
 *
 * <p><strong>Deshalb ein eigenes Record neben {@code auth.dto.UserResponse}</strong>,
 * und §3.1 verlangt das als Umsetzungspflicht. Waere es dasselbe Record,
 * gelangte die Adresse zwangslaeufig in jede Antwort, die einen User einbettet,
 * also in {@code /auth/me}, in Projekt-, Kommentar- und Portfolio-Antworten. Die
 * Trennung sichert die Regel strukturell; eine Annotation am gemeinsamen Record
 * haette man beim naechsten Feld vergessen. {@code AdminUserHsbEmailVisibilityTest}
 * haelt beide Seiten fest.
 *
 * <p>{@code passwordHash} steht hier so wenig wie irgendwo sonst (§3.1).
 *
 * @param id                     technischer Schluessel, zugleich der Pfadwert
 *                               von {@code PATCH} und {@code DELETE}
 * @param email                  private Adresse, zugleich die Login-Kennung
 * @param hsbEmail               Hochschuladresse als Zugehoerigkeitsnachweis
 * @param emailVerified          private Adresse per Code bestaetigt (§3.1.1)
 * @param hsbEmailVerified       Hochschuladresse per Code bestaetigt
 * @param passwordChangeRequired das Konto traegt noch ein administrativ
 *                               gesetztes Initialpasswort (§6.7). Steht in der
 *                               Liste, weil der Admin sonst nicht sieht, ob eine
 *                               von ihm angelegte Person schon angekommen ist
 * @param firstName              Vorname
 * @param lastName               Nachname
 * @param role                   Rolle (§2.1); ueber {@code PATCH} aenderbar
 * @param status                 Kontostatus (§2.9)
 * @param createdAt              Anlagezeitpunkt des Kontos
 * @param updatedAt              letzte Aenderung am Konto
 */
@Schema(name = "AdminUserResponse",
		description = "Ein Konto in der Nutzerverwaltung. Der einzige Antworttyp, der hsbEmail "
				+ "fremder Konten enthaelt; die eigene Adresse fuehren seit v50 auch die "
				+ "Auth-Antworten an die Person selbst (§3.1). passwordHash kommt nirgends vor.")
public record AdminUserResponse(
		UUID id,

		@Schema(description = "Private E-Mail-Adresse, zugleich die Login-Kennung (§3.1).",
				example = "erika@example.org")
		String email,

		@Schema(description = "Hochschuladresse. Wird ausschliesslich hier ausgegeben (§3.1).",
				example = "emusterfrau@stud.hs-bremen.de")
		String hsbEmail,

		boolean emailVerified,

		boolean hsbEmailVerified,

		@Schema(description = "Das Konto traegt noch ein administrativ gesetztes "
				+ "Initialpasswort und ist bis zur Aenderung gesperrt (§6.7).")
		boolean passwordChangeRequired,

		String firstName,

		String lastName,

		Role role,

		UserStatus status,

		Instant createdAt,

		Instant updatedAt) {

	public static AdminUserResponse from(User user) {
		return new AdminUserResponse(
				user.getId(),
				user.getEmail(),
				user.getHsbEmail(),
				user.isEmailVerified(),
				user.isHsbEmailVerified(),
				user.isPasswordChangeRequired(),
				user.getFirstName(),
				user.getLastName(),
				user.getRole(),
				user.getStatus(),
				user.getCreatedAt(),
				user.getUpdatedAt());
	}
}
