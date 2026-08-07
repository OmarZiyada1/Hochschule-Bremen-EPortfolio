package de.hsbremen.eportfolio.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.ServerSetupTest;
import de.hsbremen.eportfolio.config.MailProperties;
import de.hsbremen.eportfolio.config.MailProvider;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSenderImpl;

/**
 * Zustelltest des SMTP-Adapters gegen einen echten SMTP-Server (KAN-51, §6.8).
 *
 * <p><strong>Warum GreenMail und kein Dienst in {@code docker-compose.yml}.</strong>
 * Der Server laeuft im Arbeitsspeicher dieses Testlaufs und ist mit ihm wieder
 * verschwunden. Ein zusaetzlicher Container haette allen Mitarbeitenden des
 * Projekts eine Abhaengigkeit auferlegt, die nur ein einziger Test braucht, und
 * die gemeinsame Compose-Datei veraendert.
 *
 * <p>Geprueft wird, was zwischen Anwendung und Relay tatsaechlich passiert:
 * Absenderadresse und Anzeigename aus den Properties, Betreff und Text der
 * Nachricht, und der Fehlerfall bei nicht erreichbarem Relay. Der
 * {@code MimeMessageHelper} dazwischen ist fremder Code, aber die Zusammenfuegung
 * ist unsere.
 */
class SmtpMailSenderTest {

	@RegisterExtension
	static final GreenMailExtension GREEN_MAIL = new GreenMailExtension(ServerSetupTest.SMTP);

	private static final MailProperties PROPERTIES = new MailProperties(
			MailProvider.SMTP, "noreply@eportfolio.invalid", "E-Portfolio Hochschule Bremen",
			"http://localhost:5173");

	private SmtpMailSender senderAgainst(int port) {
		JavaMailSenderImpl javaMailSender = new JavaMailSenderImpl();
		javaMailSender.setHost("localhost");
		javaMailSender.setPort(port);
		return new SmtpMailSender(javaMailSender, PROPERTIES);
	}

	@Test
	@DisplayName("Die Nachricht kommt beim Relay an, mit Absender, Betreff und Text")
	void deliversMessage() throws Exception {
		senderAgainst(GREEN_MAIL.getSmtp().getPort()).send(new MailMessage(
				"person@example.org", "Bestaetigung Ihrer E-Mail-Adresse", "Ihr Code: 428193"));

		assertThat(GREEN_MAIL.waitForIncomingEmail(5000, 1)).isTrue();
		MimeMessage received = GREEN_MAIL.getReceivedMessages()[0];

		assertThat(received.getAllRecipients()[0]).hasToString("person@example.org");
		assertThat(received.getSubject()).isEqualTo("Bestaetigung Ihrer E-Mail-Adresse");
		assertThat(received.getContent()).asString().contains("428193");
		// Anzeigename und Adresse zusammen: eine falsche Absenderdomain ist der
		// haeufigste Grund dafuer, dass ein Relay Nachrichten still verwirft.
		assertThat(received.getFrom()[0])
				.hasToString("E-Portfolio Hochschule Bremen <noreply@eportfolio.invalid>");
	}

	@Test
	@DisplayName("Umlaute im Betreff kommen unveraendert an")
	void keepsUmlauts() throws Exception {
		// Ohne ausdrueckliches UTF-8 im Adapter faellt JavaMail auf die
		// Plattformkodierung zurueck, und derselbe Betreff kaeme je nach
		// Serverumgebung anders an.
		senderAgainst(GREEN_MAIL.getSmtp().getPort()).send(new MailMessage(
				"person@example.org", "Bestätigung Ihrer Hochschuladresse", "Grüße"));

		assertThat(GREEN_MAIL.waitForIncomingEmail(5000, 1)).isTrue();
		MimeMessage received = GREEN_MAIL.getReceivedMessages()[0];

		assertThat(received.getSubject()).isEqualTo("Bestätigung Ihrer Hochschuladresse");
		// Ueber getContent() und nicht ueber den Rohkoerper: ein Text mit
		// Umlauten wird base64-kodiert uebertragen, und der Rohkoerper enthielte
		// deshalb nur die Kodierung. Geprueft werden soll, was beim Empfaenger
		// ankommt.
		assertThat(received.getContent()).asString().contains("Grüße");
	}

	@Test
	@DisplayName("Fehlender Relay-Host laesst den Start scheitern, statt still ins Leere zu senden")
	void missingRelayHostFailsAtStartup() {
		// Der gefaehrlichste Fall dieses Moduls: spring.mail.* traegt keine
		// Validierung, und ein Fehlschlag beim Versand wird absichtlich
		// geschluckt. Ohne diese Pruefung liefe das Produktivsystem scheinbar
		// normal und niemand koennte sich registrieren (§6.8).
		JavaMailSenderImpl withoutHost = new JavaMailSenderImpl();
		withoutHost.setHost("${MAIL_HOST}");

		assertThatThrownBy(() -> new SmtpMailSender(withoutHost, PROPERTIES))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("spring.mail.host")
				.hasMessageContaining("MAIL_HOST");
	}

	@Test
	@DisplayName("Leerer Relay-Host zaehlt genauso als fehlend")
	void blankRelayHostFailsAtStartup() {
		// So sieht es aus, wenn jemand MAIL_HOST= aus .env.example uebernimmt
		// und den Wert nicht ausfuellt.
		JavaMailSenderImpl blankHost = new JavaMailSenderImpl();
		blankHost.setHost("   ");

		assertThatThrownBy(() -> new SmtpMailSender(blankHost, PROPERTIES))
				.isInstanceOf(IllegalStateException.class)
				.hasMessageContaining("spring.mail.host");
	}

	@Test
	@DisplayName("Nicht erreichbares Relay wirft; die Behandlung liegt eine Stufe hoeher")
	void unreachableRelayThrows() {
		// Der Adapter schluckt bewusst nichts: die Zusicherung aus §6.8 steht im
		// MailTemplateService und gilt damit fuer jeden Adapter gleich.
		// Port 1 ist reserviert und nimmt keine Verbindung an.
		assertThatThrownBy(() -> senderAgainst(1).send(new MailMessage(
				"person@example.org", "Betreff", "Text")))
				.isInstanceOf(MailSendException.class);
	}
}
