package de.hsbremen.eportfolio.common.error;

import java.util.UUID;

/**
 * Die adressierte Ressource existiert nicht. Wird vom
 * {@link GlobalExceptionHandler} auf HTTP 404 mit dem Envelope aus
 * API-Contract §6.2 abgebildet.
 *
 * <p>Der Fehlercode ist ein Feld und nicht fest verdrahtet, weil §6.2 zwei
 * 404er kennt: {@code PROJECT_NOT_FOUND} fuer Projekte und
 * {@code RESOURCE_NOT_FOUND} als generischen Fall fuer Stammdaten, Kommentare,
 * Dateien und User. Eine Exception je Ressourcenart waere derselbe Ablauf in
 * mehreren Klassen.
 *
 * <p><strong>Abgrenzung zu 403 und 401 (§6.3.1):</strong> Diese Ausnahme meint
 * ausschliesslich „gibt es nicht". Ein vorhandenes Projekt ohne Leserecht ist
 * kein Fall fuer sie: dort antwortet die API mit 403, bei fehlender Anmeldung
 * mit 401. Die Existenz wird bewusst nicht hinter einem 404 verborgen, weil IDs
 * UUIDs und damit nicht erratbar sind und weil sonst Programmierfehler im
 * Client von Berechtigungsfehlern nicht mehr unterscheidbar waeren.
 */
public class ResourceNotFoundException extends RuntimeException {

	private final String errorCode;

	public ResourceNotFoundException(String errorCode, String message) {
		super(message);
		this.errorCode = errorCode;
	}

	/** Der haeufigste Fall: eine Projekt-ID, zu der es keine Zeile gibt. */
	public static ResourceNotFoundException forProject(UUID projectId) {
		return new ResourceNotFoundException(ErrorCodes.PROJECT_NOT_FOUND,
				"Projekt mit ID " + projectId + " existiert nicht.");
	}

	public String getErrorCode() {
		return errorCode;
	}
}
