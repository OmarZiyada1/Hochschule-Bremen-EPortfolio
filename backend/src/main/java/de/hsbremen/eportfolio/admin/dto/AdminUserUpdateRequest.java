package de.hsbremen.eportfolio.admin.dto;

import de.hsbremen.eportfolio.common.enums.Role;
import de.hsbremen.eportfolio.common.enums.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code PATCH /api/admin/users/{id}} (§6.1):
 * {@code { firstName?, lastName?, role?, status? }}.
 *
 * <p><strong>Alle vier Felder sind optional</strong>, wie das Fragezeichen in
 * §6.1 sagt: {@code null} heisst „unveraendert lassen" und nicht „leeren". Bei
 * diesen vier Feldern ist das eindeutig, weil alle vier in der Tabelle
 * {@code not null} sind; es gibt also keinen Wert, den ein {@code null} meinen
 * koennte. Ein Body ohne jedes Feld ist zulaessig und aendert nichts.
 *
 * <p><strong>Die private E-Mail steht nicht darin</strong>, obwohl §7 (offener
 * Punkt 11) die Aenderung der Login-Adresse „ueber den Admin" laufen lassen
 * will. §6.1 fuehrt fuer diesen Endpoint genau vier Felder, und ein
 * Adresswechsel ohne Verifizierung der neuen Adresse waere ein Weg, ein fremdes
 * Konto zu uebernehmen. Der Punkt bleibt offen und ist dort vermerkt.
 *
 * <p><strong>Zwei Wege zur Deaktivierung, und das ist gewollt.</strong>
 * {@code status = DEACTIVATED} tut dasselbe wie
 * {@code DELETE /api/admin/users/{id}}. §6.1 fuehrt beide: das DELETE ist die
 * benannte Aktion der Oberflaeche, dieses Feld der allgemeine Weg im
 * Bearbeitungsformular. Beide rufen im Dienst denselben Code.
 *
 * @param firstName neuer Vorname; {@code null} laesst ihn unveraendert.
 * @param lastName  neuer Nachname; {@code null} laesst ihn unveraendert.
 * @param role      neue Rolle (§2.1). Hierueber laeuft die Hochstufung einer
 *                  studentischen Person zur Redaktion (Tutor-Fall, §3.1.1).
 * @param status    neuer Kontostatus. Zulaessig sind ausschliesslich
 *                  {@code ACTIVE} und {@code DEACTIVATED}, siehe unten.
 */
public record AdminUserUpdateRequest(

		// Kein @NotBlank: das Feld darf fehlen. Ein uebermittelter, aber leerer
		// Name wird im Dienst abgewiesen; Bean-Validation kennt keine
		// Annotation fuer "null erlaubt, leer nicht".
		@Schema(description = "Neuer Vorname. Fehlt das Feld, bleibt er unveraendert.",
				example = "Erika")
		@Size(max = 255, message = "Vorname ist zu lang.")
		String firstName,

		@Schema(description = "Neuer Nachname. Fehlt das Feld, bleibt er unveraendert.",
				example = "Musterfrau")
		@Size(max = 255, message = "Nachname ist zu lang.")
		String lastName,

		@Schema(description = "Neue Rolle (§2.1). Darueber laeuft die Hochstufung einer "
				+ "studentischen Person zur Redaktion (Tutor-Fall, §3.1.1).",
				example = "EDITOR")
		Role role,

		// REGISTRATION_PENDING ist ein gueltiger Wert aus §2.9, aber keiner, den
		// die Administration setzt: er beschreibt eine begonnene Registrierung
		// und wird ausschliesslich vom Flow aus §3.1.1 vergeben und wieder
		// verlassen. Ein bereits verifiziertes Konto dorthin zurueckzusetzen
		// waere eine Sperre ohne Ausweg: die Anmeldung endet mit 401
		// ACCOUNT_NOT_ACTIVE, und POST /auth/verify/resend verschickt fuer ein
		// bestaetigtes Flag nichts mehr. Fuer das Sperren gibt es DEACTIVATED.
		// Der Dienst weist den Wert deshalb mit 400 ab.
		@Schema(description = "Neuer Kontostatus. Zulaessig sind ausschliesslich ACTIVE und "
				+ "DEACTIVATED; REGISTRATION_PENDING ergibt 400 VALIDATION_FAILED.",
				allowableValues = {"ACTIVE", "DEACTIVATED"}, example = "DEACTIVATED")
		UserStatus status) {
}
