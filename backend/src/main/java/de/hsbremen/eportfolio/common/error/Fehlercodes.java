package de.hsbremen.eportfolio.common.error;

/**
 * Fehlercodes fuer das Envelope aus API-Contract §6.2.
 *
 * <p>Die Codes rund um Authentifizierung und Autorisierung sind im Contract
 * noch nicht aufgefuehrt — §6.2 listet bisher nur die Block- und Datei-Codes.
 * Sie werden hier vergeben und sind mit v11 der Seite nachzutragen.
 */
public final class Fehlercodes {

	/** 401 — gar kein Token mitgeschickt. */
	public static final String NICHT_AUTHENTIFIZIERT = "NICHT_AUTHENTIFIZIERT";

	/** 401 — Token vorhanden, aber Signatur oder Aufbau stimmen nicht. */
	public static final String TOKEN_UNGUELTIG = "TOKEN_UNGUELTIG";

	/** 401 — Token war gueltig, ist aber abgelaufen. */
	public static final String TOKEN_ABGELAUFEN = "TOKEN_ABGELAUFEN";

	/** 401 — E-Mail oder Passwort falsch. Bewusst ohne Unterscheidung. */
	public static final String ANMELDUNG_FEHLGESCHLAGEN = "ANMELDUNG_FEHLGESCHLAGEN";

	/** 401 — Konto nicht AKTIV (REGISTRIERUNG_OFFEN oder DEAKTIVIERT), §2.9. */
	public static final String KONTO_NICHT_AKTIV = "KONTO_NICHT_AKTIV";

	/**
	 * 429 — zu viele fehlgeschlagene Anmeldeversuche fuer diese E-Mail-Adresse
	 * oder diese IP. Die Meldung bleibt bewusst generisch und nennt keine
	 * Restzeit, damit sie nicht bestaetigt, dass es das Konto gibt.
	 */
	public static final String ZU_VIELE_ANMELDEVERSUCHE = "ZU_VIELE_ANMELDEVERSUCHE";

	/** 403 — angemeldet, aber die Rechtematrix (§5) erlaubt die Aktion nicht. */
	public static final String KEINE_BERECHTIGUNG = "KEINE_BERECHTIGUNG";

	private Fehlercodes() {
		// Nur Konstanten.
	}
}
