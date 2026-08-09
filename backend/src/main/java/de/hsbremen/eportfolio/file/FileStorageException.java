package de.hsbremen.eportfolio.file;

/**
 * Ein Zugriff auf den Objektspeicher ist gescheitert (§3.15.1).
 *
 * <p>Unchecked, weil die Aufrufseite den Fehler nicht sinnvoll behandeln
 * kann: ein nicht erreichbarer Speicher oder ein fehlendes Objekt zu einer
 * vorhandenen Datenbankzeile ist ein Betriebsfehler, kein Fachfall. Die
 * Ausnahme laeuft deshalb bis zum {@code GlobalExceptionHandler} durch und
 * ergibt dort 500 {@code INTERNAL_ERROR} im Envelope aus §6.2 (KAN-55).
 * Einen eigenen Fehlercode je Speicherfehler gibt es dagegen weiterhin
 * nicht: er waere die Zusage, dass der Client mit der Unterscheidung etwas
 * anfangen koennte.
 *
 * <p>Bis Contract v28 endete sie stattdessen im Servlet-Container, und die
 * Antwort war der Standardkoerper des Rahmenwerks ohne {@code errorCode}.
 * Genau daran ist die Luecke aufgefallen.
 *
 * <p>Die Meldung nennt den Schluessel, nie Container, Endpoint oder
 * Zugangsdaten: sie landet im Protokoll, und die Verbindungszeichenfolge ist
 * ein Geheimnis (§6.8).
 */
public class FileStorageException extends RuntimeException {

	public FileStorageException(String message) {
		super(message);
	}

	public FileStorageException(String message, Throwable cause) {
		super(message, cause);
	}
}
