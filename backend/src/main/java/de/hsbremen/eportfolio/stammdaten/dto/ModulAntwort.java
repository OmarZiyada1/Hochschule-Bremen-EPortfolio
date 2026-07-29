package de.hsbremen.eportfolio.stammdaten.dto;

import de.hsbremen.eportfolio.stammdaten.Modul;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Modul in der Antwort von {@code GET /api/module} (§6.1).
 *
 * @param id            technischer Schluessel
 * @param name          ausgeschriebener Name
 * @param kuerzel       Kurzform; in der Tabelle nullable und deshalb auch hier
 *                      moeglicherweise {@code null}
 * @param studiengangId Studiengang, zu dem das Modul gehoert
 */
public record ModulAntwort(
		UUID id,

		String name,

		@Schema(description = "Kurzform des Moduls. Kann fehlen.", nullable = true)
		String kuerzel,

		@Schema(description = "Studiengang, zu dem das Modul gehoert. Derselbe Wert "
				+ "dient als Filter: GET /api/module?studiengang={id}.")
		UUID studiengangId) {

	public static ModulAntwort aus(Modul modul) {
		return new ModulAntwort(
				modul.getId(),
				modul.getName(),
				modul.getKuerzel(),
				modul.getStudiengang().getId());
	}
}
