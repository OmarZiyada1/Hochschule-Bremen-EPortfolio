package de.hsbremen.eportfolio.editlock.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * Wer den Beitrag gerade haelt (§6.9).
 *
 * <p>Enthaelt bewusst nur, was der Hinweis in der Oberflaeche braucht: einen
 * Namen, eine ID und den Beginn. Weder {@code email} noch {@code hsbEmail}
 * gehoeren hier hinein (§3.1); ein eigenes Record stellt das strukturell
 * sicher, statt es an Annotationen zu haengen, die man beim naechsten Feld
 * vergisst. Dieselbe Ueberlegung wie bei
 * {@code project.dto.PersonResponse}.
 *
 * <p><strong>Warum nicht {@code PersonResponse} wiederverwendet wird:</strong>
 * die beiden beantworten verschiedene Fragen. Dort geht es um eine Person in
 * einer Projektantwort, hier um einen Zustand mit einem Zeitpunkt. Das Feld
 * {@code since} haette an einer Person nichts zu suchen, und das Profilbild
 * von dort braucht dieser Hinweis nicht. Eine gemeinsame Form zwaenge beide
 * Antworten aneinander, sobald eine von ihnen ein Feld bekommt.
 *
 * <p><strong>{@code since} ist der Beginn, nicht der letzte Herzschlag.</strong>
 * Die Oberflaeche sagt damit „bearbeitet seit 14:03" und nicht „war vor zwei
 * Sekunden da". Der letzte Herzschlag ist eine Betriebsgroesse der Sperre und
 * verlaesst den Server nicht: er wechselte alle zehn Sekunden und machte jede
 * Antwort verschieden, ohne dass sich fachlich etwas geaendert haette.
 *
 * @param userId    ID des haltenden Kontos. Der Client vergleicht sie nicht
 *                  selbst, dafuer gibt es {@code heldBySelf}
 * @param firstName Vorname
 * @param lastName  Nachname
 * @param since     Beginn der Sperre
 */
public record EditLockHolderResponse(
		UUID userId,

		String firstName,

		String lastName,

		@Schema(description = "Beginn der Sperre, nicht der letzte Herzschlag. Bleibt "
				+ "unveraendert, solange dieselbe Person haelt.")
		Instant since) {
}
