package de.hsbremen.eportfolio.mail;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import de.hsbremen.eportfolio.config.MailProperties;
import de.hsbremen.eportfolio.config.MailProvider;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Tests der Vorlagen aus KAN-51 und des Wechselcodes aus KAN-60 (§3.1.1, §6.1).
 *
 * <p>Bewusst ohne Spring-Kontext und damit ohne {@code @Async}: geprueft wird,
 * was in der Nachricht steht und dass ein Fehler des Adapters den Aufrufer nicht
 * erreicht. Beides ist Logik dieser Klasse und braucht weder Datenbank noch
 * Threadpool. Der direkt erzeugte Service laeuft synchron, weil {@code @Async}
 * erst ueber den Spring-Proxy wirkt: genau das macht die Zusicherung
 * ueberpruefbar, denn ein asynchron abgeschickter Aufruf wuerde auch dann keine
 * Ausnahme werfen, wenn gar keine Behandlung existierte.
 */
class MailTemplateServiceTest {

	private static final String CODE = "428193";

	private static final Duration VALIDITY = Duration.ofMinutes(15);

	private static final MailProperties PROPERTIES = new MailProperties(
			MailProvider.LOG, "noreply@eportfolio.invalid", "E-Portfolio Hochschule Bremen",
			"http://localhost:5173");

	private final RecordingMailSender sender = new RecordingMailSender();

	private final MailTemplateService service = new MailTemplateService(sender, PROPERTIES);

	/**
	 * Alle Anlaesse als aufrufbare Einheit, damit die Zusicherungen, die fuer
	 * alle gelten (kein Code im Betreff, Code im Text), nur einmal dastehen und
	 * beim naechsten Anlass nicht vergessen werden.
	 */
	private static List<Consumer<MailTemplateService>> allTemplates() {
		return List.of(
				service -> service.sendPrivateEmailVerification("person@example.org", CODE, VALIDITY),
				service -> service.sendHsbEmailVerification("person@hs-bremen.de", CODE, VALIDITY),
				service -> service.sendPasswordReset("person@example.org", CODE, VALIDITY),
				service -> service.sendEmailChangeVerification("neu@example.org", CODE, VALIDITY));
	}

	@Test
	@DisplayName("Keine Vorlage traegt den Code in der Betreffzeile")
	void noCodeInAnySubject() {
		for (Consumer<MailTemplateService> template : allTemplates()) {
			template.accept(service);
		}

		assertThat(sender.sent)
				.as("Betreffzeilen erscheinen auf Sperrbildschirmen; ein Einmalgeheimnis gehoert nicht dorthin")
				.hasSize(4)
				.allSatisfy(message -> assertThat(message.subject()).doesNotContain(CODE));
	}

	@Test
	@DisplayName("Jede Vorlage traegt den Code im Textkoerper")
	void everyTemplateCarriesTheCode() {
		for (Consumer<MailTemplateService> template : allTemplates()) {
			template.accept(service);
		}

		assertThat(sender.sent).hasSize(4).allSatisfy(message -> {
			assertThat(message.bodyText()).contains(CODE);
			// Ohne Gueltigkeitsdauer weiss die Person nicht, ob sie den Code
			// jetzt gleich braucht oder spaeter noch benutzen kann.
			assertThat(message.bodyText()).contains("15 Minuten");
			assertThat(message.bodyText()).contains(PROPERTIES.baseUrl());
		});
	}

	@Test
	@DisplayName("Keine Vorlage bietet eine HTML-Fassung an")
	void templatesAreTextOnly() {
		for (Consumer<MailTemplateService> template : allTemplates()) {
			template.accept(service);
		}

		assertThat(sender.sent).allSatisfy(message -> assertThat(message.hasHtml()).isFalse());
	}

	@Nested
	@DisplayName("Die einzelnen Vorlagen")
	class Templates {

		@Test
		@DisplayName("Private Adresse: geht an die private Adresse und nennt sie als Login-Kennung")
		void privateEmail() {
			service.sendPrivateEmailVerification("person@example.org", CODE, VALIDITY);

			MailMessage message = sender.only();
			assertThat(message.to()).isEqualTo("person@example.org");
			assertThat(message.subject()).isEqualTo("Bestätigung Ihrer E-Mail-Adresse");
			assertThat(unwrapped(message)).contains("Mit dieser Adresse melden Sie sich später an");
		}

		@Test
		@DisplayName("HSB-Adresse: sagt ausdruecklich, dass sie keine Login-Kennung ist")
		void hsbEmail() {
			service.sendHsbEmailVerification("person@hs-bremen.de", CODE, VALIDITY);

			MailMessage message = sender.only();
			assertThat(message.to()).isEqualTo("person@hs-bremen.de");
			assertThat(message.subject()).isEqualTo("Bestätigung Ihrer Hochschuladresse");
			// Die Verwechslung der beiden Adressen ist die haeufigste
			// Fehlbedienung des Flusses (§3.1.1).
			assertThat(unwrapped(message)).contains("angemeldet wird sich weiterhin mit Ihrer privaten Adresse");
		}

		@Test
		@DisplayName("E-Mail-Wechsel: geht an die neue Adresse und beruhigt Unbeteiligte")
		void emailChange() {
			service.sendEmailChangeVerification("neu@example.org", CODE, VALIDITY);

			MailMessage message = sender.only();
			assertThat(message.to()).isEqualTo("neu@example.org");
			assertThat(message.subject()).isEqualTo("Bestätigung Ihrer neuen E-Mail-Adresse");
			// Die neue Adresse kann einer unbeteiligten Person gehoeren, wenn
			// sich jemand vertippt hat (KAN-60).
			assertThat(unwrapped(message))
					.contains("Erst nach der Bestätigung wird sie zur Anmeldeadresse")
					.contains("Die bisherige Anmeldeadresse bleibt dann unverändert gültig");
		}

		@Test
		@DisplayName("Passwort zuruecksetzen: enthaelt den Hinweis fuer Unbeteiligte")
		void passwordReset() {
			service.sendPasswordReset("person@example.org", CODE, VALIDITY);

			MailMessage message = sender.only();
			assertThat(message.subject()).isEqualTo("Passwort zurücksetzen");
			// Diese Mail kann jemanden erreichen, der selbst nichts angestossen
			// hat: jede:r kann die Ruecksetzung fuer eine fremde Adresse
			// ausloesen.
			assertThat(unwrapped(message))
					.contains("Falls Sie das nicht waren")
					.contains("Ihr bisheriges Passwort bleibt gültig");
		}
	}

	@Nested
	@DisplayName("Ein fehlgeschlagener Versand blockiert den Fachvorgang nicht (§6.8)")
	class FailingAdapter {

		private final MailTemplateService failing = new MailTemplateService(
				message -> {
					throw new IllegalStateException("Relay nicht erreichbar");
				},
				PROPERTIES);

		@Test
		@DisplayName("Keine Ausnahme erreicht den Aufrufer")
		void exceptionDoesNotReachCaller() {
			// Genau diese Zusicherung laesst POST /auth/register mit 201
			// antworten, obwohl die Mail nicht rausging: das Konto ist angelegt,
			// und der Code ist ueber POST /auth/verify/resend erneut
			// anforderbar (§6.1).
			assertThatCode(() -> {
				failing.sendPrivateEmailVerification("person@example.org", CODE, VALIDITY);
				failing.sendHsbEmailVerification("person@hs-bremen.de", CODE, VALIDITY);
				failing.sendPasswordReset("person@example.org", CODE, VALIDITY);
				failing.sendEmailChangeVerification("neu@example.org", CODE, VALIDITY);
			}).doesNotThrowAnyException();
		}
	}

	@Nested
	@DisplayName("Gueltigkeitsdauer als Text")
	class ValidityText {

		@Test
		@DisplayName("Minuten und Stunden, Einzahl ausgeschrieben")
		void formats() {
			assertThat(MailTemplateService.formatValidity(Duration.ofMinutes(15))).isEqualTo("15 Minuten");
			assertThat(MailTemplateService.formatValidity(Duration.ofMinutes(1))).isEqualTo("eine Minute");
			assertThat(MailTemplateService.formatValidity(Duration.ofHours(1))).isEqualTo("eine Stunde");
			assertThat(MailTemplateService.formatValidity(Duration.ofHours(24))).isEqualTo("24 Stunden");
		}
	}

	/**
	 * Textkoerper in einer Zeile, damit Zusicherungen ueber Formulierungen nicht
	 * an der Stelle des Zeilenumbruchs haengen.
	 *
	 * <p>Die Vorlagen sind hart umbrochen, damit sie in einem schmalen
	 * Mailfenster lesbar bleiben. Ein Satz kann deshalb ueber zwei Zeilen laufen,
	 * und ohne diesen Schritt scheiterte eine Pruefung schon daran, dass jemand
	 * ein Wort ergaenzt und der Umbruch dadurch wandert. Geprueft werden soll,
	 * was dasteht, nicht wo es umbricht.
	 */
	private static String unwrapped(MailMessage message) {
		return message.bodyText().replaceAll("\\s+", " ");
	}

	/** Haelt fest, was der Service abgeschickt haette. */
	private static final class RecordingMailSender implements MailSender {

		private final List<MailMessage> sent = new ArrayList<>();

		@Override
		public void send(MailMessage message) {
			sent.add(message);
		}

		private MailMessage only() {
			assertThat(sent).hasSize(1);
			return sent.get(0);
		}
	}
}
