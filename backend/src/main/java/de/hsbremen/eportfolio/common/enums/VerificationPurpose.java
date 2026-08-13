package de.hsbremen.eportfolio.common.enums;

/**
 * Wozu ein Einmalcode ausgestellt wurde (API-Contract §2.11).
 *
 * <p>Die beiden E-Mail-Zwecke gehoeren zum Registrierungsflow aus §3.1.1 und
 * entstehen mit KAN-26. {@link #PASSWORD_RESET} steht bereits hier, obwohl ihn
 * erst KAN-43 ausstellt: §2.11 fuehrt die drei Werte als einen Wertevorrat, und
 * der Check-Constraint der Tabelle muss ihn ohnehin kennen. Ihn spaeter
 * nachzureichen waere eine zweite Migration fuer einen Wert, der heute schon
 * feststeht.
 *
 * <p>Warum das Zuruecksetzen denselben Mechanismus benutzt, begruendet §2.11:
 * ein Ruecksetzcode ist fachlich dasselbe kurzlebige Einmalgeheimnis, und eine
 * zweite Tabelle daneben haette dieselben Ablauf- und Verbrauchsregeln ein
 * zweites Mal gefuehrt.
 */
public enum VerificationPurpose {

	/** Bestaetigung der privaten Adresse, also der Login-Kennung (§3.1). */
	PRIVATE_EMAIL,

	/** Bestaetigung der Hochschuladresse, also des Zugehoerigkeitsnachweises. */
	HSB_EMAIL,

	/** Zuruecksetzen eines vergessenen Passworts (§6.1, Umsetzung in KAN-43). */
	PASSWORD_RESET,

	/**
	 * Bestaetigung einer <em>neuen</em> privaten Adresse beim selbstaendigen
	 * Wechsel der Login-Kennung (§3.1, KAN-60). Der Code geht an die neue
	 * Adresse; erst sein Einloesen macht sie zur gueltigen Kennung. Bis dahin
	 * steht sie in {@code User.pendingEmail}.
	 */
	EMAIL_CHANGE
}
