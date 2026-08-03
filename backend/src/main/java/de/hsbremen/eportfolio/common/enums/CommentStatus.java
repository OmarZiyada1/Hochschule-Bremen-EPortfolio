package de.hsbremen.eportfolio.common.enums;

/**
 * Bearbeitungsstand eines Kommentars.
 *
 * <p>{@code OPEN} und nicht {@code PENDING} wie bei {@link NominationStatus}:
 * ein Aenderungswunsch ist offen, solange er nicht umgesetzt ist, waehrend eine
 * Nominierung auf eine Entscheidung wartet (docs/NAMENSSCHEMA.md §3).
 */
public enum CommentStatus {
	OPEN,
	RESOLVED
}
