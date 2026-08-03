package de.hsbremen.eportfolio.common.error;

/**
 * Fehlercodes fuer das Envelope aus API-Contract §6.2.
 *
 * <p>Stand Contract v17 steht jede Konstante dieser Klasse auch in §6.2.
 * {@link #VALIDIERUNG_FEHLGESCHLAGEN} war bis v14 nur hier gefuehrt und wurde
 * mit v15 nachgetragen (Tabelle „Fehlercodes Anfrageformat", Historieneintrag
 * in §10). {@link #PROJEKT_NICHT_GEFUNDEN} lag umgekehrt: er stand seit jeher
 * in §6.2 und kam mit KAN-16 hier dazu.
 *
 * <p>Umgekehrt fuehrt §6.2 Codes, die hier noch fehlen: die Block- und
 * Datei-Codes, {@code PROJEKT_UNVOLLSTAENDIG}, {@code RESSOURCE_NICHT_GEFUNDEN},
 * die beiden {@code PROJEKT_STATUS_*}-Konflikte,
 * {@code RESSOURCE_IN_VERWENDUNG}, {@code PASSWORTAENDERUNG_ERFORDERLICH} und
 * seit v17 {@code VERIFIZIERUNGSCODE_UNGUELTIG}. Sie kommen mit dem jeweiligen Modul
 * dazu; das ist keine Abweichung, sondern der noch offene Umsetzungsstand aus
 * §8.
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

	/**
	 * 400 — die Anfrage ist formal unbrauchbar: Bean-Validation an einem
	 * Request-Body schlaegt fehl oder ein Parameter hat nicht den erwarteten Typ
	 * (z. B. {@code ?fakultaet=abc}, wo eine UUID stehen muss).
	 *
	 * <p>Der Code wurde im {@code GlobalExceptionHandler} bereits als Literal
	 * benutzt und steht jetzt hier, damit er nicht an zwei Stellen auseinander
	 * laufen kann. Wie die uebrigen Codes ist er in §6.2 nachzutragen.
	 */
	public static final String VALIDIERUNG_FEHLGESCHLAGEN = "VALIDIERUNG_FEHLGESCHLAGEN";

	/**
	 * 404: unter dieser ID gibt es kein Projekt.
	 *
	 * <p>Wird auch dann geliefert, wenn die anfragende Person das Projekt gar
	 * nicht lesen duerfte: die Existenz einer Ressource wird nach §6.3.1 nicht
	 * verschleiert. Ein vorhandenes Projekt ohne Leserecht ergibt stattdessen
	 * 403 {@link #KEINE_BERECHTIGUNG} bzw. 401
	 * {@link #NICHT_AUTHENTIFIZIERT}.
	 */
	public static final String PROJEKT_NICHT_GEFUNDEN = "PROJEKT_NICHT_GEFUNDEN";

	/**
	 * 409: das Projekt wurde zwischen Laden und Speichern von jemand anderem
	 * geaendert (Optimistic Locking, §6.4). Der Client laedt neu und meldet den
	 * Konflikt, statt fremde Arbeit zu ueberschreiben.
	 */
	public static final String PROJEKT_VERSION_KONFLIKT = "PROJEKT_VERSION_KONFLIKT";

	private Fehlercodes() {
		// Nur Konstanten.
	}
}
