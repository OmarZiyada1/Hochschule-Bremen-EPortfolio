package de.hsbremen.eportfolio.mail;

import de.hsbremen.eportfolio.config.ConfigurationValues;
import de.hsbremen.eportfolio.config.MailProperties;
import jakarta.mail.internet.MimeMessage;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * Adapter fuer {@code app.mail.provider=smtp}: Versand ueber ein SMTP-Relay
 * (API-Contract §6.8). Der Betriebsfall.
 *
 * <p><strong>Bewusst auf keinen Anbieter zugeschnitten.</strong> Gmail, das
 * Relay des Rechenzentrums der HSB, Azure Communication Services und ein
 * Testserver sprechen alle SMTP; sie unterscheiden sich in Host, Port und
 * Anmeldedaten, also genau in dem, was nach KAN-50 aus der Umgebung kommt
 * ({@code spring.mail.*}). In dieser Klasse steht deshalb kein Anbietername.
 *
 * <p>Der Absender kommt aus {@link MailProperties} und nicht aus der Nachricht:
 * er ist eine Eigenschaft des Systems (§6.8) und muss zur Domain des Relays
 * passen, sonst weist dieses die Nachricht ab.
 */
@Component
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "smtp")
public class SmtpMailSender implements MailSender {

	private final JavaMailSender javaMailSender;

	private final MailProperties properties;

	public SmtpMailSender(JavaMailSender javaMailSender, MailProperties properties) {
		this.javaMailSender = javaMailSender;
		this.properties = properties;
		requireRelayHost(javaMailSender);
	}

	/**
	 * Bricht den Start ab, wenn {@code spring.mail.host} fehlt.
	 *
	 * <p><strong>Warum diese Pruefung hier noetig ist und nicht wie sonst im
	 * Properties-Record steht.</strong> {@code spring.mail.*} sind Springs eigene
	 * Properties; sie sind nicht ueber {@code @Validated} gebunden und tragen
	 * damit keine der Pruefungen aus §6.8. Springs Autokonfiguration wiederum
	 * legt den Versand-Bean schon an, wenn der Schluessel ueberhaupt gesetzt ist,
	 * und ein leerer oder nicht aufgeloester Wert zaehlt dabei als gesetzt.
	 *
	 * <p>Ohne diese Zeilen ergaebe das genau das Szenario, das §6.8 ausschliessen
	 * will, nur ueber einen anderen Weg als den Log-Adapter: die Anwendung kaeme
	 * im Profil prod anstandslos hoch, das Startprotokoll meldete
	 * {@code Mail-Adapter=smtp}, und jeder Versand scheiterte gegen einen Host
	 * namens {@code ${MAIL_HOST}}. Auffallen wuerde das nirgends, weil
	 * {@link MailTemplateService} den Fehlschlag absichtlich leise macht: es
	 * faellt erst auf, wenn sich niemand mehr registrieren kann.
	 *
	 * <p>Geprueft wird nur der Host. Benutzername und Passwort sind bei einem
	 * Relay ohne Anmeldung zulaessig leer, und der Port hat einen brauchbaren
	 * Vorgabewert; ein fehlender Host dagegen ist unter keinen Umstaenden
	 * richtig.
	 */
	private static void requireRelayHost(JavaMailSender javaMailSender) {
		if (!(javaMailSender instanceof JavaMailSenderImpl impl)) {
			// Ein anderer Versand-Bean bringt seine Verbindungsdaten selbst mit;
			// dann gibt es hier nichts zu pruefen.
			return;
		}

		List<String> missing = new ArrayList<>();
		if (ConfigurationValues.isMissing(impl.getHost())) {
			missing.add("spring.mail.host (MAIL_HOST)");
		}

		ConfigurationValues.failIfMissing("app.mail.provider=smtp", missing);
	}

	/**
	 * Baut die MIME-Nachricht und uebergibt sie dem Relay.
	 *
	 * <p>Wirft bei einem Fehler weiter; abgefangen und protokolliert wird eine
	 * Stufe hoeher im {@link MailTemplateService}, damit beide Adapter dieselbe
	 * Behandlung erfahren und diese nur an einer Stelle steht.
	 *
	 * <p>UTF-8 ausdruecklich gesetzt: ohne Angabe faellt JavaMail auf die
	 * Plattformkodierung zurueck, und ein Betreff mit Umlaut kaeme je nach
	 * Serverumgebung unterschiedlich an.
	 */
	@Override
	public void send(MailMessage message) {
		MimeMessage mimeMessage = javaMailSender.createMimeMessage();
		try {
			MimeMessageHelper helper = new MimeMessageHelper(
					mimeMessage, message.hasHtml(), StandardCharsets.UTF_8.name());
			helper.setFrom(properties.fromAddress(), properties.fromName());
			helper.setTo(message.to());
			helper.setSubject(message.subject());
			if (message.hasHtml()) {
				helper.setText(message.bodyText(), message.bodyHtml());
			}
			else {
				helper.setText(message.bodyText());
			}
		}
		catch (jakarta.mail.MessagingException | UnsupportedEncodingException e) {
			// Fehler beim Zusammenbauen, nicht beim Versenden: eine ungueltige
			// Adresse oder ein nicht darstellbarer Anzeigename. Als
			// Spring-Mail-Exception weitergereicht, damit der Aufrufer nur einen
			// Ausnahmetyp kennen muss.
			throw new MailPreparationException("Nachricht liess sich nicht zusammenbauen", e);
		}

		javaMailSender.send(mimeMessage);
	}
}
