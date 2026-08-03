package de.hsbremen.eportfolio.common.enums;

/**
 * Rolle eines Benutzers und damit dessen Berechtigungsumfang in der Anwendung.
 *
 * <p>{@code EDITOR} meint die redaktionelle Rolle, nie den blockbasierten
 * Editor der Oberflaeche; der heisst im Code durchgehend {@code BlockEditor}
 * (docs/NAMENSSCHEMA.md §3).
 */
public enum Role {
	STUDENT,
	EDITOR,
	ADMIN
}
