package de.hsbremen.eportfolio.masterdata.dto;

import de.hsbremen.eportfolio.masterdata.Category;
import java.util.UUID;

/**
 * Eine Kategorie in der Antwort von {@code GET /api/categories} (§6.1).
 *
 * <p>Eigenes Record und keine serialisierte Entity, aus demselben Grund wie bei
 * {@code UserResponse}: was die API ausliefert, soll an einer Stelle stehen und
 * sich nicht aendern, sobald jemand der Entity ein Feld hinzufuegt.
 *
 * @param id   technischer Schluessel; das Frontend schickt ihn beim Anlegen
 *             eines Projekts zurueck
 * @param name Anzeigename, in {@code category.name} eindeutig
 */
public record CategoryResponse(UUID id, String name) {

	public static CategoryResponse from(Category category) {
		return new CategoryResponse(category.getId(), category.getName());
	}
}
