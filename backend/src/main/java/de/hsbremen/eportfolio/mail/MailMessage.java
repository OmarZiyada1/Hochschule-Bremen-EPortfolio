package de.hsbremen.eportfolio.mail;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

/**
 * Eine zuzustellende Nachricht (API-Contract §6.8).
 *
 * <p><strong>Absender und Anzeigename stehen bewusst nicht hier.</strong> Sie
 * sind eine Eigenschaft des Systems und nicht des einzelnen Versands; sie kommen
 * aus {@code MailProperties} (KAN-50). Stuenden sie in der Nachricht, muesste
 * jede aufrufende Stelle sie mitgeben und koennte sie unterschiedlich setzen.
 *
 * @param to       Empfaengeradresse.
 * @param subject  Betreffzeile. <strong>Niemals mit einem Code darin</strong>,
 *                 siehe {@link MailTemplateService}.
 * @param bodyText Textkoerper. Pflicht, auch wenn eine HTML-Fassung vorliegt:
 *                 der Textteil ist die Rueckfallebene fuer Programme, die kein
 *                 HTML darstellen, und fuer Screenreader oft die brauchbarere
 *                 Fassung.
 * @param bodyHtml Optionale HTML-Fassung, {@code null} wenn es keine gibt. Die
 *                 Vorlagen aus KAN-51 setzen sie nicht: eine Mail mit sechs
 *                 Ziffern und zwei Saetzen gewinnt durch Auszeichnung nichts und
 *                 wuerde in mancher Umgebung eher als Werbung eingestuft.
 */
public record MailMessage(
		@NotBlank @Email String to,
		@NotBlank String subject,
		@NotBlank String bodyText,
		String bodyHtml) {

	/** Nachricht ohne HTML-Fassung, der Regelfall in diesem Projekt. */
	public MailMessage(String to, String subject, String bodyText) {
		this(to, subject, bodyText, null);
	}

	/** Ob eine HTML-Fassung vorliegt; entscheidet im Adapter ueber den Nachrichtentyp. */
	public boolean hasHtml() {
		return bodyHtml != null && !bodyHtml.isBlank();
	}

	/**
	 * Ohne die Nachrichtentexte, weil im Textkoerper der Verifizierungscode steht.
	 *
	 * <p>Das generierte {@code toString()} eines Records gibt jedes Feld aus. Eine
	 * einzige spaetere Zeile {@code LOG.debug("...", message)} legte damit ein
	 * Einmalgeheimnis ins Protokoll, und zwar an einer Stelle, die beim Schreiben
	 * voellig harmlos aussieht. Dieselbe Ueberlegung haelt den Code aus der
	 * Betreffzeile heraus (siehe {@link MailTemplateService}).
	 *
	 * <p>Die Laenge bleibt stehen: sie hilft beim Eingrenzen einer leeren oder
	 * abgeschnittenen Nachricht und verraet nichts.
	 */
	@Override
	public String toString() {
		return "MailMessage[to=%s, subject=%s, bodyText=%d Zeichen, bodyHtml=%s]"
				.formatted(to, subject, bodyText == null ? 0 : bodyText.length(), hasHtml() ? "ja" : "nein");
	}
}
