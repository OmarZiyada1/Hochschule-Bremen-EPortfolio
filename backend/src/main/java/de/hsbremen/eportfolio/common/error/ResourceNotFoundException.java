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

	/**
	 * Gemeinsames Satzende aller Meldungen. Der Wortlaut steht an einer Stelle,
	 * damit die drei Faelle nicht auseinanderlaufen: das Frontend entscheidet
	 * zwar nach {@code errorCode} und nie nach dem Text, die Meldung landet aber
	 * in Protokollen und in der Fehleranzeige.
	 */
	private static final String DOES_NOT_EXIST = " existiert nicht.";

	private final String errorCode;

	public ResourceNotFoundException(String errorCode, String message) {
		super(message);
		this.errorCode = errorCode;
	}

	/** Der haeufigste Fall: eine Projekt-ID, zu der es keine Zeile gibt. */
	public static ResourceNotFoundException forProject(UUID projectId) {
		return new ResourceNotFoundException(ErrorCodes.PROJECT_NOT_FOUND,
				"Projekt mit ID " + projectId + DOES_NOT_EXIST);
	}

	/**
	 * Eine Kommentar-ID, zu der es keine Zeile gibt (§3.5). Traegt den
	 * generischen Code {@code RESOURCE_NOT_FOUND}, weil §6.2 einen eigenen 404er
	 * nur fuer das Projekt fuehrt.
	 */
	public static ResourceNotFoundException forComment(UUID commentId) {
		return new ResourceNotFoundException(ErrorCodes.RESOURCE_NOT_FOUND,
				"Kommentar mit ID " + commentId + DOES_NOT_EXIST);
	}

	/**
	 * Eine Benutzer-ID, zu der es kein Konto gibt (§3.1), etwa in
	 * {@code GET /api/portfolios/{userId}}. Traegt wie
	 * {@link #forComment(UUID)} den generischen Code, den §6.2 fuer User
	 * ausdruecklich vorsieht.
	 *
	 * <p>Die Meldung spricht bewusst vom Konto und nicht vom Portfolio: der 404
	 * haengt an der Person, nicht an ihrer Profil-Zeile. Fehlt allein die Zeile,
	 * antwortet der Endpoint mit 200 und leeren Feldern (§3.2.1).
	 */
	public static ResourceNotFoundException forUser(UUID userId) {
		return new ResourceNotFoundException(ErrorCodes.RESOURCE_NOT_FOUND,
				"Benutzer mit ID " + userId + DOES_NOT_EXIST);
	}

	/**
	 * Eine Top-10-Nominierung, zu der es keine Zeile gibt (§3.11), etwa in
	 * {@code POST /api/admin/top10-nominations/{id}/accept}. Traegt wie die
	 * uebrigen Faelle den generischen Code {@code RESOURCE_NOT_FOUND}, weil §6.2
	 * einen eigenen 404er nur fuer das Projekt fuehrt.
	 *
	 * <p>Auch hier gilt §6.3.1: eine entschiedene Nominierung ist nicht „nicht
	 * gefunden", sondern vorhanden. Sie ergibt 409
	 * {@code NOMINATION_ALREADY_DECIDED} und nicht diesen 404.
	 */
	public static ResourceNotFoundException forNomination(UUID nominationId) {
		return new ResourceNotFoundException(ErrorCodes.RESOURCE_NOT_FOUND,
				"Top-10-Nominierung mit ID " + nominationId + DOES_NOT_EXIST);
	}

	public String getErrorCode() {
		return errorCode;
	}
}
