package de.hsbremen.eportfolio.auth;

import java.util.Locale;

/**
 * Zwei Regeln im Umgang mit E-Mail-Adressen, an einer Stelle gefuehrt.
 *
 * <p><strong>Adressen werden kleingeschrieben gespeichert und gesucht.</strong>
 * Der Domainteil ist ohnehin nicht zwischen Gross- und Kleinschreibung zu
 * unterscheiden, und kein gebraeuchlicher Mailanbieter unterscheidet sie im
 * lokalen Teil. Ohne diese Regel waeren {@code Max@example.org} und
 * {@code max@example.org} zwei verschiedene Konten, obwohl beide dasselbe
 * Postfach meinen: der Unique-Constraint aus §3.1 griffe nicht, und wer sich mit
 * anderer Schreibweise anmeldet als er sich registriert hat, fiele auf ein
 * „E-Mail-Adresse oder Passwort ist falsch" herein, das er nicht aufloesen kann.
 *
 * <p>Die Regel muss deshalb an <em>allen</em> Stellen gelten: bei der
 * Registrierung, bei der Anmeldung und bei jedem Nachschlagen im
 * Verifizierungsflow. Der {@code AttemptCounter} schrieb Adressen schon vorher
 * fuer seine Schluessel klein, aus demselben Grund.
 */
public final class EmailAddresses {

	private EmailAddresses() {
		// Nur statische Hilfsmethoden.
	}

	/**
	 * Fuehrende und abschliessende Leerzeichen weg, alles klein.
	 *
	 * <p>{@code null} bleibt {@code null}: die Pflichtfeldpruefung ist Sache der
	 * Bean-Validation am Request-Record, nicht dieser Methode.
	 */
	public static String normalize(String email) {
		return email == null ? null : email.trim().toLowerCase(Locale.ROOT);
	}

	/**
	 * Der Teil hinter dem <strong>letzten</strong> {@code @}, kleingeschrieben.
	 *
	 * <p>Das letzte und nicht das erste {@code @}, weil der lokale Teil einer
	 * Adresse in Anfuehrungszeichen selbst ein {@code @} enthalten darf. Fuer die
	 * Domainpruefung aus §3.1.1 zaehlt allein, was dahinter steht.
	 *
	 * @return die Domain, oder eine leere Zeichenkette, wenn die Eingabe gar keine
	 *         Adresse ist. Ein leerer Rueckgabewert steht in keiner der beiden
	 *         Listen und fuehrt damit zum selben 400 wie eine fremde Domain
	 */
	public static String domainOf(String email) {
		String normalized = normalize(email);
		if (normalized == null) {
			return "";
		}
		int at = normalized.lastIndexOf('@');
		return at < 0 ? "" : normalized.substring(at + 1);
	}
}
