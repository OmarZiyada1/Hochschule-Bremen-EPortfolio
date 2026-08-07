package de.hsbremen.eportfolio.mail;

/**
 * Port fuer die Zustellung einer Nachricht (API-Contract §6.8).
 *
 * <p><strong>Warum ein eigener Port und nicht direkt {@code JavaMailSender}.</strong>
 * Dieser ist bereits eine Abstraktion, aber eine ueber SMTP. Ein spaeterer
 * Wechsel auf einen HTTP-API-Anbieter (Postmark, Brevo, SES) waere damit ein
 * Eingriff in jeden aufrufenden Service. Der eigene Port kostet ein Interface
 * und macht denselben Wechsel zu einer zusaetzlichen Adapterklasse.
 *
 * <p><strong>Der Port ist synchron und wirft.</strong> Ein Adapter meldet einen
 * Fehlschlag nach oben, statt ihn zu schlucken. Die Zusage aus §6.8, dass ein
 * gescheiterter Versand den Fachvorgang trotzdem gelingen laesst, wird eine
 * Stufe hoeher eingeloest, naemlich in {@link MailTemplateService}: dort sitzen
 * {@code @Async} und die Fehlerbehandlung. So gilt sie fuer jeden Adapter
 * gleichermassen, und ein neuer Adapter muss nichts ueber sie wissen.
 *
 * <p><strong>Fachcode ruft diesen Port nicht direkt auf</strong>, sondern
 * ausschliesslich {@link MailTemplateService}. Wer hier vorbeigeht, bekommt den
 * synchronen und werfenden Weg und damit genau die Blockade des Fachvorgangs,
 * die §6.8 ausschliesst.
 */
public interface MailSender {

	/**
	 * Stellt die Nachricht zu.
	 *
	 * @throws org.springframework.mail.MailException wenn die Zustellung
	 *         scheitert. Behandelt wird das im {@link MailTemplateService}.
	 */
	void send(MailMessage message);
}
