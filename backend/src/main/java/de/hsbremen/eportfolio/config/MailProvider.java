package de.hsbremen.eportfolio.config;

/**
 * Auswaehlbare Adapter des Ports {@code MailSender} (API-Contract §6.8).
 *
 * <p>Der Wert steht in {@code app.mail.provider} und entscheidet, welche
 * Implementierung KAN-51 ueber {@code @ConditionalOnProperty} aktiviert.
 * Begruendung fuer Enum statt String und fuer den fehlenden Default wie bei
 * {@link StorageProvider}; beim Mailversand wiegt der stille Rueckfall sogar
 * schwerer: ein Produktivsystem, das Verifizierungscodes ins Log schreibt statt
 * sie zu versenden, faellt erst auf, wenn sich niemand mehr registrieren kann.
 */
public enum MailProvider {

	/**
	 * Schreibt die Nachricht in die Serverkonsole, statt sie zu versenden. Fuer
	 * die Entwicklung: der Verifizierungscode aus §3.1.1 steht dann im Log und
	 * es braucht kein Postfach.
	 */
	LOG,

	/**
	 * Versand ueber ein SMTP-Relay. Der Betriebsfall.
	 *
	 * <p>Deckt jedes Relay ab, das SMTP spricht, also auch Azure Communication
	 * Services und das Rechenzentrum der HSB. Die Verbindungsdaten selbst
	 * (Host, Port, Zugangsdaten) gehoeren nicht in {@link MailProperties},
	 * sondern unter {@code spring.mail.*}; sie entstehen mit dem Adapter in
	 * KAN-51.
	 */
	SMTP
}
