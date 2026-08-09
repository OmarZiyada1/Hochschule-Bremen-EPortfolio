package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code POST /api/admin/categories} (§6.1, §3.6).
 *
 * <p>Getrennt von {@link CategoryUpdateRequest}, obwohl beide dasselbe eine Feld
 * tragen: beim Anlegen ist der Name Pflicht, beim Aendern optional
 * ({@code null} heisst „unveraendert"). Mit einem gemeinsamen Record liesse sich
 * das nicht mit Bean-Validation ausdruecken, und die Pflichtpruefung wanderte
 * fuer den einen Weg in den Dienst, waehrend sie fuer den anderen am Record
 * bliebe. Dieselbe Aufteilung tragen die drei uebrigen Stammdatenarten.
 *
 * @param name Anzeigename. In {@code category.name} eindeutig; ein bereits
 *             vergebener Name ergibt 409 {@code RESOURCE_IN_USE}.
 */
public record CategoryCreateRequest(

		@Schema(description = "Anzeigename der Kategorie, eindeutig.", example = "Interaction Design")
		@NotBlank(message = "Name fehlt.")
		@Size(max = 255, message = "Name ist zu lang.")
		String name) {
}
