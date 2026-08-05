package de.hsbremen.eportfolio.config;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Konfiguration des Mailversands ({@code app.mail}, API-Contract §6.8).
 *
 * <p>Wie {@link StorageProperties} legt dieser Record nur den Adapter und die
 * anwendungsseitigen Werte fest. Der Port {@code MailSender} und seine beiden
 * Implementierungen entstehen in KAN-51.
 *
 * <p><strong>Hier steht kein Geheimnis.</strong> Absender, Anzeigename und
 * Basis-URL sind oeffentliche Angaben und tragen deshalb Vorgabewerte in
 * {@code application.yml}; die SMTP-Verbindung samt Zugangsdaten gehoert unter
 * {@code spring.mail.*} und kommt mit dem Adapter in KAN-51 dazu. Deshalb
 * braucht dieser Record auch keine bedingte Pruefung wie
 * {@link StorageProperties}: seine vier Werte sind in jedem Profil und fuer
 * beide Adapter noetig.
 *
 * <p>Nicht zu verwechseln mit Springs eigenem
 * {@code org.springframework.boot.autoconfigure.mail.MailProperties} unter
 * {@code spring.mail}. Die beiden Praefixe ueberschneiden sich nicht.
 *
 * @param provider    Aktiver Adapter. Ohne Wert startet die Anwendung nicht
 *                    (§6.8).
 * @param fromAddress Absenderadresse der Verifizierungs- und Ruecksetzmails
 *                    (§3.1.1). Im Profil prod aus der Umgebung, weil sie zur
 *                    Domain des jeweiligen Relays passen muss: ein Absender,
 *                    fuer den das Relay nicht zustaendig ist, landet im
 *                    Spamordner oder wird abgewiesen.
 * @param fromName    Anzeigename des Absenders.
 * @param baseUrl     Basis der Links in Mails, also der Ort, an dem das
 *                    Frontend erreichbar ist. Konfiguriert statt aus dem
 *                    Request abgeleitet: der Verifizierungslink entsteht in
 *                    einem asynchronen Versand (§6.8) und damit ausserhalb
 *                    jedes Requests. Aus einem {@code Host}-Header abgeleitet
 *                    waere er ausserdem von aussen steuerbar.
 */
@Validated
@ConfigurationProperties(prefix = "app.mail")
public record MailProperties(
		@NotNull MailProvider provider,
		@NotBlank @Email String fromAddress,
		@NotBlank String fromName,
		@NotBlank String baseUrl) {

	public MailProperties {
		requireResolvedValues(fromAddress, baseUrl);
	}

	/**
	 * Faengt die beiden Werte ab, die im Profil prod aus der Umgebung kommen und
	 * dort als nicht aufgeloester Platzhalter stehenbleiben koennten (siehe
	 * {@link ConfigurationValues}).
	 *
	 * <p>{@code fromName} fehlt hier bewusst: der Wert hat einen Vorgabewert in
	 * {@code application.yml} und wird von keinem Profil aus der Umgebung
	 * gesetzt, kann also gar nicht als Platzhalter ankommen.
	 *
	 * <p>Der leere und der fehlende Fall bleiben bei {@code @NotBlank} und
	 * {@code @Email}; hier steht nur, was Bean Validation nicht sehen kann.
	 */
	private static void requireResolvedValues(String fromAddress, String baseUrl) {
		List<String> missing = new ArrayList<>();
		if (fromAddress != null && ConfigurationValues.isMissing(fromAddress)) {
			missing.add("app.mail.from-address (MAIL_FROM_ADDRESS)");
		}
		if (baseUrl != null && ConfigurationValues.isMissing(baseUrl)) {
			missing.add("app.mail.base-url (APP_BASE_URL)");
		}

		ConfigurationValues.failIfMissing("app.mail ist konfiguriert", missing);
	}
}
