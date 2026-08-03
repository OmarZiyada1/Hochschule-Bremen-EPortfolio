package de.hsbremen.eportfolio.common.error;

import java.time.Instant;

/**
 * Einheitliches Fehler-Envelope aller API-Antworten (API-Contract §6.2).
 */
public record ApiError(
		Instant timestamp,
		int status,
		String errorCode,
		String message,
		String path) {
}
