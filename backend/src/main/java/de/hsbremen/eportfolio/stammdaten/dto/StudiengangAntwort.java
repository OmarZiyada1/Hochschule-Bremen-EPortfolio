package de.hsbremen.eportfolio.stammdaten.dto;

import de.hsbremen.eportfolio.stammdaten.Studiengang;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Studiengang in der Antwort von {@code GET /api/studiengaenge} (§6.1).
 *
 * @param id          technischer Schluessel, zugleich der Filterwert von
 *                    {@code GET /api/module?studiengang={id}}
 * @param name        ausgeschriebener Name
 * @param kuerzel     Kurzform; in der Tabelle nullable und deshalb auch hier
 *                    moeglicherweise {@code null}
 * @param fakultaetId Fakultaet, zu der der Studiengang gehoert
 */
public record StudiengangAntwort(
		UUID id,

		String name,

		// Anders als bei der Fakultaet ist diese Spalte nullable (Migration 2).
		// Ohne den Hinweis baut das Frontend die Anzeige auf einen Wert, den es
		// nicht immer gibt.
		@Schema(description = "Kurzform des Studiengangs. Kann fehlen.", nullable = true)
		String kuerzel,

		@Schema(description = "Fakultaet, zu der der Studiengang gehoert. Derselbe Wert "
				+ "dient als Filter: GET /api/studiengaenge?fakultaet={id}.")
		UUID fakultaetId) {

	public static StudiengangAntwort aus(Studiengang studiengang) {
		return new StudiengangAntwort(
				studiengang.getId(),
				studiengang.getName(),
				studiengang.getKuerzel(),
				studiengang.getFakultaet().getId());
	}
}
