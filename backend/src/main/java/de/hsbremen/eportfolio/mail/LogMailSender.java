package de.hsbremen.eportfolio.mail;

import de.hsbremen.eportfolio.config.MailProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Adapter fuer {@code app.mail.provider=log}: schreibt die Nachricht in die
 * Serverkonsole, statt sie zu versenden (API-Contract §6.8).
 *
 * <p>Zweck ist das Entwickeln ohne Fremddienst. Der Verifizierungscode aus
 * §3.1.1 steht damit im Log, und der Registrierungsflow ist lokal vollstaendig
 * durchlaufbar, ohne dass ein Postfach oder ein Relay noetig waere.
 *
 * <p><strong>Nur im Profil dev.</strong> Der Code steht hier im Klartext, also
 * genau das, was §3.16 fuer die Datenbank ausschliesst. Dass ein Produktivsystem
 * nicht versehentlich hier landet, sichert der fehlende Default fuer
 * {@code app.mail.provider} (§6.8): ohne die Property startet die Anwendung
 * gar nicht.
 */
@Component
@ConditionalOnProperty(name = "app.mail.provider", havingValue = "log")
public class LogMailSender implements MailSender {

	private static final Logger LOG = LoggerFactory.getLogger(LogMailSender.class);

	private final MailProperties properties;

	public LogMailSender(MailProperties properties) {
		this.properties = properties;
	}

	/**
	 * Der Textkoerper steht bewusst mit im Protokoll: ohne ihn waere der Code
	 * nicht ablesbar und der Adapter fuer seinen einzigen Zweck unbrauchbar.
	 */
	@Override
	public void send(MailMessage message) {
		LOG.info("""
				Mail (Adapter log, nicht versandt)
				  Von:     {} <{}>
				  An:      {}
				  Betreff: {}
				{}""",
				properties.fromName(), properties.fromAddress(),
				message.to(), message.subject(), message.bodyText());
	}
}
