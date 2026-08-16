package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code POST /api/admin/semesters} (§6.1, §3.18).
 *
 * <p>Getrennt von {@link SemesterUpdateRequest} wie bei den Kategorien: beim
 * Anlegen ist der Name Pflicht, beim Aendern optional.
 *
 * <p>Die Reihenfolge steht bewusst <em>nicht</em> im Body. Ein neues Semester
 * kommt ans Ende und wird danach mit den Pfeilen an seinen Platz gebracht
 * ({@code POST /api/admin/semesters/{id}/move}). Duerfte der Aufrufer
 * {@code sortOrder} setzen, muesste der Dienst bei jeder Anlage die uebrigen
 * Zeilen verschieben, und zwei gleichzeitige Anlagen ergaeben stillschweigend
 * dieselbe Position.
 *
 * @param name   Anzeigename, in {@code semester.name} eindeutig; ein bereits
 *               vergebener ergibt 409 {@code RESOURCE_IN_USE}
 * @param active {@code null} bedeutet {@code true}: ein frisch angelegtes
 *               Semester soll im Regelfall sofort waehlbar sein
 */
public record SemesterCreateRequest(

		@Schema(description = "Anzeigename des Semesters, eindeutig.", example = "WiSe 2026/27")
		@NotBlank(message = "Name fehlt.")
		@Size(max = 64, message = "Name ist zu lang (hoechstens 64 Zeichen).")
		String name,

		@Schema(description = "Steht das Semester bei der Projektanlage zur Auswahl? "
				+ "Fehlt das Feld, ist es aktiv.", example = "true", nullable = true)
		Boolean active) {
}
