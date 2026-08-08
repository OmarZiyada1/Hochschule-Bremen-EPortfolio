package de.hsbremen.eportfolio.auth;

/**
 * Regeln fuer ein selbst gewaehltes Passwort, an einer Stelle gefuehrt.
 *
 * <p>Der API-Contract legt keine fest; entschieden in der Klaerungsrunde zu
 * KAN-26 und nachgetragen in §3.1.1. Die Regel ist bewusst <strong>nur eine
 * Mindestlaenge und keine Zeichenklassen-Vorgabe</strong>: eine Vorgabe wie
 * „Grossbuchstabe, Ziffer, Sonderzeichen" erzeugt erfahrungsgemaess kurze
 * Passwoerter mit vorhersagbarem Muster ({@code Passwort1!}), waehrend zwoelf
 * Zeichen auch ein Merksatz erfuellt. BSI und NIST empfehlen heute genau diese
 * Richtung.
 *
 * <p>Die Konstanten liegen hier und nicht am Request-Record, weil dieselbe Regel
 * fuer die Passwortaenderung (KAN-28, §6.7) und das Zuruecksetzen (KAN-43, §6.1)
 * gilt. Drei Records mit je eigener Zahl waeren drei Gelegenheiten, sie
 * auseinanderlaufen zu lassen.
 *
 * <p>Sie sind {@code static final int} und keine Properties, weil
 * Bean-Validation-Annotationen einen Konstantenausdruck zur Uebersetzungszeit
 * brauchen. Eine konfigurierbare Mindestlaenge muesste die Pruefung aus dem
 * Record in den Service verlagern und ist fuer eine Regel, die sich nicht je
 * Umgebung unterscheidet, den Aufwand nicht wert.
 */
public final class PasswordPolicy {

	/** Mindestlaenge in Zeichen. */
	public static final int MIN_LENGTH = 12;

	/**
	 * Obergrenze in Zeichen.
	 *
	 * <p><strong>Kein Sicherheitsmerkmal, sondern ein BCrypt-Detail:</strong> der
	 * Algorithmus verarbeitet nur die ersten 72 Byte und ignoriert den Rest
	 * stillschweigend. Ohne diese Grenze waeren zwei lange Passwoerter, die sich
	 * erst ab Zeichen 73 unterscheiden, dasselbe Passwort, ohne dass es jemand
	 * bemerkt. Gezaehlt werden hier Zeichen und nicht Byte; bei Umlauten liegt die
	 * Grenze damit etwas frueher als noetig, was in die sichere Richtung irrt.
	 */
	public static final int MAX_LENGTH = 72;

	/** Wortlaut fuer {@code @Size}, damit alle drei Endpoints dieselbe Meldung geben. */
	public static final String MESSAGE =
			"Das Passwort muss zwischen " + MIN_LENGTH + " und " + MAX_LENGTH + " Zeichen lang sein.";

	private PasswordPolicy() {
		// Nur Konstanten.
	}
}
