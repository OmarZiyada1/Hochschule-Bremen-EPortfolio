package de.hsbremen.eportfolio.config;

import java.time.Duration;

/**
 * Grenzwerte einer Versuchszaehlung: wie viele Versuche ein Schluessel hat und
 * wie lange die Sperre danach gilt (API-Contract §6.5).
 *
 * <p><strong>Warum es diese Schnittstelle gibt.</strong> Die Zaehlmechanik
 * selbst steht seit KAN-26 an einer Stelle ({@code auth.AttemptCounter}) und
 * wird von mehreren Anlaessen benutzt: dem Login, den Verifizierungs- und
 * Passwort-Endpoints und seit KAN-85 dem oeffentlichen Kontaktformular. Die
 * ersten beiden teilen sich mit §6.5 ausdruecklich dieselben Werte und lesen
 * deshalb beide {@link LoginAttemptProperties}. Das Kontaktformular tut das
 * nicht: seine Grenzwerte sind eigene (§6.5, Absatz zu v87), weil eine
 * Anmeldung nach einem Vertipper sofort wiederholt wird und eine Support-Anfrage
 * einmal geschrieben. Damit der Zaehler beide bedienen kann, ohne die Mechanik
 * ein zweites Mal zu schreiben, nimmt er nicht mehr einen bestimmten
 * Properties-Record entgegen, sondern diese Schnittstelle.
 *
 * <p><strong>Sie liegt hier und nicht in {@code auth}</strong>, weil sie die
 * gemeinsame Form zweier {@code @ConfigurationProperties}-Records beschreibt und
 * die liegen nach der Regel aus {@code package-info} ausnahmslos in diesem
 * Paket. Ein zweiter Ort fuer denselben Wertebegriff waere genau die halbe
 * Regel, die KAN-50 aufgeloest hat.
 *
 * <p>Die Namen sind bewusst neutral: {@code maxAttempts} statt
 * {@code maxFailedAttempts}, weil nicht jeder Anlass Fehlversuche zaehlt. Am
 * Login sind es fehlgeschlagene Anmeldungen, am Kontaktformular ist es jede
 * Einsendung, auch die erfolgreiche.
 */
public interface AttemptLimits {

	/**
	 * Versuche je Schluessel, bevor gesperrt wird. Gezaehlt wird getrennt nach
	 * E-Mail-Adresse und Client-IP; schon einer der beiden Zaehler loest die
	 * Sperre aus (§6.5).
	 */
	int maxAttempts();

	/**
	 * Dauer der Sperre, gerechnet ab dem Versuch, der die Grenze erreicht hat.
	 *
	 * <p>Sie ist zugleich das Zeitfenster der Zaehlung: ein Schluessel, der die
	 * Grenze nicht erreicht, wird nach dieser Frist ohne letzten Versuch
	 * aufgeraeumt und faengt wieder bei null an.
	 */
	Duration lockoutDuration();
}
