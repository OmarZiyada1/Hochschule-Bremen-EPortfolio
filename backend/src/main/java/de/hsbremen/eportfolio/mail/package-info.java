/**
 * Feature Mail: Zustellung der Verifizierungs- und Ruecksetzcodes
 * (API-Contract §6.8, §3.1.1).
 *
 * <p>Das Paket besteht aus drei Teilen: dem Port {@code MailSender} mit der
 * Nachricht {@code MailMessage}, zwei Adaptern dahinter
 * ({@code LogMailSender}, {@code SmtpMailSender}) und dem
 * {@code MailTemplateService}, der je fachlichem Anlass eine fertige Nachricht
 * baut.
 *
 * <p><strong>Wer hier hereinschaut und wer nicht.</strong> Aufrufende Services
 * kennen ausschliesslich den {@code MailTemplateService}; welcher Adapter
 * dahinter arbeitet, entscheidet {@code app.mail.provider} und sieht der
 * Fachcode nie. Deshalb ist der Wechsel von einem SMTP-Relay auf einen
 * HTTP-Anbieter eine zusaetzliche Klasse in diesem Paket und kein Eingriff in
 * die Registrierung.
 */
package de.hsbremen.eportfolio.mail;
