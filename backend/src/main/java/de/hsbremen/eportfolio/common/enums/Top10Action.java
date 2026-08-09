package de.hsbremen.eportfolio.common.enums;

/**
 * Art der protokollierten Aenderung an der Top-10-Auswahl (§2.12, §3.17).
 *
 * <p>Die drei Werte beschreiben die <strong>Wirkung auf die Liste</strong> und
 * nicht den Anlass. {@code REMOVED} steht deshalb auch dann, wenn ein Platz ohne
 * Entscheidung der Administration frei wird, also wenn das Projekt
 * {@code PUBLISHED} verlaesst oder geloescht wird; wer gehandelt hat, steht in
 * {@code Top10AuditEntry.admin} (§2.12, Ergaenzung mit Contract v28).
 */
public enum Top10Action {

	/** Projekt in die Top-10 aufgenommen. Traegt nur {@code newPosition}. */
	ADDED,

	/** Projekt aus der Top-10 entfernt. Traegt nur {@code previousPosition}. */
	REMOVED,

	/** Platz eines Projekts innerhalb der Top-10 geaendert. Traegt beide Positionen. */
	REORDERED
}
