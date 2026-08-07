package de.hsbremen.eportfolio.mail;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import de.hsbremen.eportfolio.config.MailProperties;
import de.hsbremen.eportfolio.config.MailProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

/**
 * Tests des Log-Adapters (KAN-51, §6.8).
 *
 * <p>Der Adapter hat genau eine Aufgabe: den Verifizierungscode aus §3.1.1 so in
 * die Serverkonsole schreiben, dass der Registrierungsflow im Profil dev ohne
 * Postfach durchlaufbar ist. Steht der Code nicht lesbar im Protokoll, ist
 * der Adapter fuer seinen einzigen Zweck unbrauchbar, ohne dass irgendetwas
 * fehlschlaegt: deshalb dieser Test.
 */
class LogMailSenderTest {

	private static final MailProperties PROPERTIES = new MailProperties(
			MailProvider.LOG, "noreply@eportfolio.invalid", "E-Portfolio Hochschule Bremen",
			"http://localhost:5173");

	private ch.qos.logback.classic.Logger logger;

	private ListAppender<ILoggingEvent> appender;

	@BeforeEach
	void captureLog() {
		LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
		logger = context.getLogger(LogMailSender.class);
		appender = new ListAppender<>();
		appender.setContext(context);
		appender.start();
		logger.addAppender(appender);
	}

	@AfterEach
	void releaseLog() {
		logger.detachAppender(appender);
		appender.stop();
	}

	@Test
	@DisplayName("Empfaenger, Betreff und Code stehen auf INFO in der Konsole")
	void writesMessageToLog() {
		new LogMailSender(PROPERTIES).send(new MailMessage(
				"person@example.org", "Bestaetigung Ihrer E-Mail-Adresse", "Ihr Code: 428193"));

		assertThat(appender.list).hasSize(1);
		ILoggingEvent event = appender.list.get(0);

		assertThat(event.getLevel()).isEqualTo(Level.INFO);
		assertThat(event.getFormattedMessage())
				.contains("person@example.org")
				.contains("Bestaetigung Ihrer E-Mail-Adresse")
				// Ohne den Code im Protokoll braeuchte auch die Entwicklung ein
				// Postfach, und genau das soll der Adapter ersparen.
				.contains("428193")
				.contains("noreply@eportfolio.invalid");
	}

	@Test
	@DisplayName("Die Zeile sagt, dass nichts versandt wurde")
	void saysNothingWasSent() {
		new LogMailSender(PROPERTIES).send(new MailMessage("person@example.org", "Betreff", "Text"));

		// Ohne diesen Zusatz liest sich die Zeile wie eine Versandbestaetigung,
		// und ein Fehlstart im falschen Profil faellt genau dadurch nicht auf.
		assertThat(appender.list.get(0).getFormattedMessage()).contains("nicht versandt");
	}
}
