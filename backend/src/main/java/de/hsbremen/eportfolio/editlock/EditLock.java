package de.hsbremen.eportfolio.editlock;

import java.time.Instant;
import java.util.UUID;

/**
 * Eine gehaltene Bearbeitungssperre (§6.9), so wie sie im Arbeitsspeicher
 * steht.
 *
 * <p><strong>Zwei Zeitpunkte, und sie bedeuten Verschiedenes.</strong>
 * {@code since} ist der Beginn und aendert sich nicht, solange dieselbe Person
 * haelt; er geht in die Antwort und traegt den Satz „bearbeitet seit". Aus
 * {@code lastSeen} ergibt sich der Ablauf; er wandert mit jedem Herzschlag
 * weiter und verlaesst den Server nie. Beides in einem Feld zu fuehren hiesse,
 * sich fuer eine der beiden Aussagen zu entscheiden: entweder liefe die Sperre
 * nach {@code ttl} ab, obwohl jemand daran arbeitet, oder die Anzeige
 * behauptete, die Bearbeitung habe gerade erst begonnen.
 *
 * <p><strong>Der Name liegt im Eintrag, nicht in der Datenbank.</strong> Der
 * Grund ist der Ort des Lesens: {@link EditLockGuard} sitzt in jedem
 * Autosave-Takt und in jedem Metadatenschreiben, und dort waere eine Abfrage
 * je Aufruf teuer und ueberfluessig. Geholt wird er einmal beim Erwerb, ueber
 * die Projektion {@code UserRepository.findNameById}. Dass ein
 * zwischenzeitlich geaenderter Name bis zum naechsten Erwerb veraltet ist,
 * wird bewusst getragen: die Sperre lebt Sekunden.
 *
 * @param userId    Konto, das haelt
 * @param firstName Vorname zum Anzeigen
 * @param lastName  Nachname zum Anzeigen
 * @param since     Beginn der Sperre
 * @param lastSeen  letzter Herzschlag, Grundlage des Ablaufs
 */
public record EditLock(
		UUID userId,
		String firstName,
		String lastName,
		Instant since,
		Instant lastSeen) {
}
