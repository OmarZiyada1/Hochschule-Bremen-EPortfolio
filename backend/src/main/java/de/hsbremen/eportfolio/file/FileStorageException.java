package de.hsbremen.eportfolio.file;

/**
 * Ein Zugriff auf den Objektspeicher ist gescheitert (§3.15.1).
 *
 * <p>Unchecked, weil die Aufrufseite den Fehler nicht sinnvoll behandeln
 * kann: ein nicht erreichbarer Speicher oder ein fehlendes Objekt zu einer
 * vorhandenen Datenbankzeile ist ein Betriebsfehler, kein Fachfall. Die
 * Ausnahme laeuft deshalb bis zum Servlet-Container durch und ergibt 500;
 * ein eigener Fehlercode in §6.2 waere die Zusage, dass der Client damit
 * etwas anfangen koennte, und die gibt es nicht.
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
