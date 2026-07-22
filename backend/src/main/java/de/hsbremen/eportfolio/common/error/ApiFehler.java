package de.hsbremen.eportfolio.common.error;

import java.time.Instant;

/**
 * Einheitliches Fehler-Envelope aller API-Antworten (API-Contract §6.2).
 */
public record ApiFehler(
		Instant zeitpunkt,
		int status,
		String fehlercode,
		String meldung,
		String pfad) {
}
