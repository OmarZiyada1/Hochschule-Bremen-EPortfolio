package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code PATCH /api/admin/semesters/{id}} (§6.1, §3.18).
 *
 * <p>Beide Felder sind optional: {@code null} heisst &bdquo;unveraendert
 * lassen&ldquo;. Ein uebermittelter, aber leerer Name wird im Dienst mit 400
 * abgewiesen, weil {@code semester.name} {@code not null} ist.
 *
 * <p><strong>Das Deaktivieren laeuft ueber dieses Feld</strong> und nicht ueber
 * einen eigenen Endpoint: {@code active} ist ein gewoehnliches Attribut der
 * Zeile und kein Zustandsuebergang mit Vorbedingungen wie in §4.1. Ein
 * {@code POST /deactivate} taeuschte eine Mechanik vor, die es hier nicht gibt.
 *
 * @param name   neuer Anzeigename; {@code null} laesst ihn unveraendert
 * @param active neuer Auswahlzustand; {@code null} laesst ihn unveraendert
 */
public record SemesterUpdateRequest(

		@Schema(description = "Neuer Anzeigename. Fehlt das Feld, bleibt er unveraendert.",
				example = "WiSe 2026/27", nullable = true)
		@Size(max = 64, message = "Name ist zu lang (hoechstens 64 Zeichen).")
		String name,

		@Schema(description = "Steht das Semester bei der Projektanlage zur Auswahl? Fehlt das "
				+ "Feld, bleibt der Zustand unveraendert.", example = "false", nullable = true)
		Boolean active) {
}
