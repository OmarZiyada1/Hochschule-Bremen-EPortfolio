package de.hsbremen.eportfolio.mail;

import de.hsbremen.eportfolio.config.AsyncConfig;
import de.hsbremen.eportfolio.config.MailProperties;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Baut und versendet die Nachrichten des Registrierungs- und
 * Ruecksetzflusses (API-Contract §3.1.1, §6.1).
 *
 * <p>Dies ist die einzige Klasse, die der Fachcode kennt: welcher Adapter
 * dahinter arbeitet, entscheidet {@code app.mail.provider} (§6.8). Je
 * fachlichem Anlass gibt es genau eine Methode.
 *
 * <p><strong>Kein Code steht in einer Betreffzeile.</strong> Betreffzeilen
 * erscheinen in Benachrichtigungen auf Sperrbildschirmen und in
 * Vorschaufenstern, also dort, wo niemand angemeldet sein muss. Ein
 * Einmalgeheimnis gehoert nicht an eine Stelle, die ohne Entsperren lesbar ist.
 * {@code MailTemplateServiceTest} haelt das fuer alle drei Vorlagen fest.
 *
 * <p><strong>Die Vorlagen liegen im Code und nicht in der Datenbank.</strong>
 * Sie aendern sich nur mit dem Code; eine Verwaltungsoberflaeche dafuer waere
 * Aufwand ohne Nutzer.
 *
 * <p><strong>Der Versand blockiert den Fachvorgang nicht</strong> (§6.8): jede
 * Methode laeuft ueber den Executor aus {@link AsyncConfig} und faengt jeden
 * Fehler ab. Scheitert die Zustellung, gilt die Registrierung trotzdem als
 * erfolgreich, denn der Code ist ueber {@code POST /auth/verify/resend} erneut
 * anforderbar (§6.1). Ein Rollback nur wegen eines kurz nicht erreichbaren
 * Mailservers wuerde ein bereits angelegtes Konto samt Portfolio verwerfen und
 * die Person vor einen Fehler stellen, den sie nicht aufloesen kann.
 */
@Service
public class MailTemplateService {

	private static final Logger LOG = LoggerFactory.getLogger(MailTemplateService.class);

	// Ab hier echte Umlaute: das ist der einzige Text des Backends, den eine
	// Aussenstehende unveraendert im Postfach liest, und er laeuft nicht ueber
	// i18n. Javadoc und Kommentare bleiben nach Hausschreibweise umschrieben.
	// Dass die Umlaute in UTF-8 beim Empfaenger ankommen, haelt
	// SmtpMailSenderTest fest.
	private static final String SUBJECT_PRIVATE_EMAIL = "Bestätigung Ihrer E-Mail-Adresse";

	private static final String SUBJECT_HSB_EMAIL = "Bestätigung Ihrer Hochschuladresse";

	private static final String SUBJECT_PASSWORD_RESET = "Passwort zurücksetzen";

	private final MailSender mailSender;

	private final MailProperties properties;

	public MailTemplateService(MailSender mailSender, MailProperties properties) {
		this.mailSender = mailSender;
		this.properties = properties;
	}

	/**
	 * Bestaetigung der privaten Adresse, also der Login-Kennung (§3.1.1).
	 *
	 * @param validity Gueltigkeitsdauer des Codes. Als Parameter und nicht als
	 *                 Property dieses Moduls: wie lange ein Code gilt, entscheidet
	 *                 der Registrierungsflow (KAN-26, §3.16), der ihn auch
	 *                 erzeugt und ablaufen laesst. Stuende der Wert hier, gaebe es
	 *                 ihn zweimal, mit der ueblichen Folge, dass die Mail
	 *                 irgendwann eine andere Dauer nennt als die Pruefung
	 *                 anwendet.
	 */
	@Async(AsyncConfig.MAIL_EXECUTOR)
	public void sendPrivateEmailVerification(String to, String code, Duration validity) {
		send(new MailMessage(to, SUBJECT_PRIVATE_EMAIL, """
				Guten Tag,

				mit diesem Code bestätigen Sie Ihre private E-Mail-Adresse für das
				E-Portfolio der Hochschule Bremen. Mit dieser Adresse melden Sie sich
				später an.

				Ihr Code: %s

				Der Code ist %s gültig. Geben Sie ihn unter %s ein.

				Falls Sie sich nicht registriert haben, können Sie diese Nachricht
				ignorieren. Ohne Bestätigung entsteht kein nutzbares Konto.

				%s"""
				.formatted(code, formatValidity(validity), properties.baseUrl(), properties.fromName())));
	}

	/**
	 * Bestaetigung der Hochschuladresse. Sie belegt ausschliesslich die
	 * Zugehoerigkeit zur Hochschule und ist keine Login-Kennung (§3.1.1); der
	 * Text sagt das, weil die Verwechslung die haeufigste Fehlbedienung ist.
	 */
	@Async(AsyncConfig.MAIL_EXECUTOR)
	public void sendHsbEmailVerification(String to, String code, Duration validity) {
		send(new MailMessage(to, SUBJECT_HSB_EMAIL, """
				Guten Tag,

				mit diesem Code bestätigen Sie Ihre Hochschuladresse für das
				E-Portfolio der Hochschule Bremen. Sie weist Ihre Zugehörigkeit zur
				Hochschule nach; angemeldet wird sich weiterhin mit Ihrer privaten
				Adresse.

				Ihr Code: %s

				Der Code ist %s gültig. Geben Sie ihn unter %s ein.

				Falls Sie sich nicht registriert haben, können Sie diese Nachricht
				ignorieren. Ohne Bestätigung entsteht kein nutzbares Konto.

				%s"""
				.formatted(code, formatValidity(validity), properties.baseUrl(), properties.fromName())));
	}

	/**
	 * Ruecksetzen eines vergessenen Passworts (§6.1, Zweck
	 * {@code PASSWORD_RESET} aus §2.11).
	 *
	 * <p>Der Hinweis „falls Sie das nicht waren" steht hier ausdruecklich: anders
	 * als bei der Registrierung kann diese Mail eine Person erreichen, die selbst
	 * nichts angestossen hat, weil jede:r die Ruecksetzung fuer eine fremde
	 * Adresse ausloesen kann. Sie muss erfahren, dass ihr Passwort unveraendert
	 * gilt, solange sie den Code nicht benutzt.
	 */
	@Async(AsyncConfig.MAIL_EXECUTOR)
	public void sendPasswordReset(String to, String code, Duration validity) {
		send(new MailMessage(to, SUBJECT_PASSWORD_RESET, """
				Guten Tag,

				für Ihr Konto im E-Portfolio der Hochschule Bremen wurde das
				Zurücksetzen des Passworts angefordert.

				Ihr Code: %s

				Der Code ist %s gültig. Geben Sie ihn unter %s ein und vergeben Sie
				anschließend ein neues Passwort.

				Falls Sie das nicht waren, müssen Sie nichts tun: Ihr bisheriges
				Passwort bleibt gültig, solange dieser Code nicht verwendet wird.
				Geben Sie ihn an niemanden weiter.

				%s"""
				.formatted(code, formatValidity(validity), properties.baseUrl(), properties.fromName())));
	}

	// ------------------------------------------------------------------

	/**
	 * Uebergibt die Nachricht an den Adapter und schluckt jeden Fehler.
	 *
	 * <p>Hier steht die Behandlung, die §6.8 fuer beide Adapter gleichermassen
	 * verlangt, und deshalb an einer Stelle statt in jedem Adapter erneut.
	 * Gefangen wird {@code Exception} und nicht nur die Mail-Ausnahmen: ein
	 * kuenftiger Adapter ueber eine HTTP-API wirft die Ausnahmen seines eigenen
	 * Clients, und die Zusage „der Fachvorgang gilt trotzdem als erfolgreich"
	 * darf nicht davon abhaengen, welche Typen dieser Adapter kennt.
	 *
	 * <p>Die Empfaengeradresse steht in der Fehlermeldung, der Code nicht: sonst
	 * stuende das Einmalgeheimnis im Protokoll jedes Betriebssystems, auf dem der
	 * Versand einmal fehlschlaegt.
	 */
	private void send(MailMessage message) {
		try {
			mailSender.send(message);
		}
		catch (Exception e) {
			LOG.error("Mailversand an {} fehlgeschlagen (Betreff: {}). "
					+ "Der Fachvorgang bleibt erfolgreich; der Code ist erneut anforderbar.",
					message.to(), message.subject(), e);
		}
	}

	/**
	 * Gueltigkeitsdauer als deutscher Text, etwa „15 Minuten" oder „24 Stunden".
	 *
	 * <p>Bewusst grob gerundet und ohne Sekunden: die Angabe soll einer Person
	 * sagen, ob sie den Code jetzt gleich braucht oder morgen noch benutzen kann.
	 * Eine minutengenaue Angabe waere ohnehin falsch, sobald die Mail ein paar
	 * Sekunden unterwegs ist.
	 */
	static String formatValidity(Duration validity) {
		long minutes = validity.toMinutes();
		if (minutes < 60) {
			return minutes == 1 ? "eine Minute" : minutes + " Minuten";
		}
		long hours = validity.toHours();
		return hours == 1 ? "eine Stunde" : hours + " Stunden";
	}
}
