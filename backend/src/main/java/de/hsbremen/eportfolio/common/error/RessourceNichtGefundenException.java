package de.hsbremen.eportfolio.common.error;

import java.util.UUID;

/**
 * Die adressierte Ressource existiert nicht. Wird vom
 * {@link GlobalExceptionHandler} auf HTTP 404 mit dem Envelope aus
 * API-Contract §6.2 abgebildet.
 *
 * <p>Der Fehlercode ist ein Feld und nicht fest verdrahtet, weil §6.2 zwei
 * 404er kennt: {@code PROJEKT_NICHT_GEFUNDEN} fuer Projekte und
 * {@code RESSOURCE_NICHT_GEFUNDEN} als generischen Fall fuer Stammdaten,
 * Kommentare, Dateien und User. Eine Exception je Ressourcenart waere
 * derselbe Ablauf in mehreren Klassen.
 *
 * <p><strong>Abgrenzung zu 403 und 401 (§6.3.1):</strong> Diese Ausnahme meint
 * ausschliesslich „gibt es nicht". Ein vorhandenes Projekt ohne Leserecht ist
 * kein Fall fuer sie: dort antwortet die API mit 403, bei fehlender Anmeldung
 * mit 401. Die Existenz wird bewusst nicht hinter einem 404 verborgen, weil IDs
 * UUIDs und damit nicht erratbar sind und weil sonst Programmierfehler im
 * Client von Berechtigungsfehlern nicht mehr unterscheidbar waeren.
 */
public class RessourceNichtGefundenException extends RuntimeException {

	private final String fehlercode;

	public RessourceNichtGefundenException(String fehlercode, String meldung) {
		super(meldung);
		this.fehlercode = fehlercode;
	}

	/** Der haeufigste Fall: eine Projekt-ID, zu der es keine Zeile gibt. */
	public static RessourceNichtGefundenException fuerProjekt(UUID projektId) {
		return new RessourceNichtGefundenException(Fehlercodes.PROJEKT_NICHT_GEFUNDEN,
				"Projekt mit ID " + projektId + " existiert nicht.");
	}

	public String getFehlercode() {
		return fehlercode;
	}
}
