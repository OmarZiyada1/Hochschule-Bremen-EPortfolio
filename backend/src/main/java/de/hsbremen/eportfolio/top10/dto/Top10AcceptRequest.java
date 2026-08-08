package de.hsbremen.eportfolio.top10.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Body von {@code POST /api/admin/top10-nominations/{id}/accept} (§6.1).
 *
 * <p><strong>Der Platz ist Pflicht</strong>, anders als der Vorschlag in
 * {@link Top10NominationRequest}. §6.1 fuehrt fuer diese Zeile ausdruecklich
 * {@code { position }} (1 bis 10). Ihn optional zu machen hiesse, dass der
 * Server sich beim Annehmen selbst einen Platz aussucht, und damit waere die
 * Kuratierung genau an der Stelle keine Entscheidung mehr, an der sie eine sein
 * soll.
 *
 * <p>Der Vorschlag aus der Nominierung wird bewusst <strong>nicht</strong> als
 * Vorbelegung eingesetzt: er ist unverbindlich, und ein stillschweigend
 * uebernommener Wunsch waere von einer bewussten Entscheidung nicht mehr zu
 * unterscheiden. Die Oberflaeche darf ihn im Formular vorbelegen, der Server
 * nicht.
 *
 * @param position Platz 1 bis 10, auf den das Projekt kommt
 */
public record Top10AcceptRequest(

		@Schema(description = "Platz in der Top-10, auf den das Projekt kommt. Ist der Platz "
				+ "bereits belegt, antwortet der Endpoint mit 409 RESOURCE_IN_USE.",
				example = "3", requiredMode = Schema.RequiredMode.REQUIRED)
		@NotNull(message = "Der Platz ist beim Annehmen Pflicht (§6.1).")
		@Min(value = 1, message = "Der Platz liegt zwischen 1 und 10.")
		@Max(value = 10, message = "Der Platz liegt zwischen 1 und 10.")
		Integer position) {
}
