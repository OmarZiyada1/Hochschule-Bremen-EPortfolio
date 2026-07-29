package de.hsbremen.eportfolio.stammdaten.dto;

import de.hsbremen.eportfolio.stammdaten.Fakultaet;
import java.util.UUID;

/**
 * Eine Fakultaet in der Antwort von {@code GET /api/fakultaeten} (§6.1).
 *
 * @param id      technischer Schluessel, zugleich der Filterwert von
 *                {@code GET /api/studiengaenge?fakultaet={id}}
 * @param name    ausgeschriebener Name, z. B. „Elektrotechnik und Informatik"
 * @param kuerzel Kurzform wie {@code FK4}; in {@code fakultaet.kuerzel} eindeutig
 *                und not null
 */
public record FakultaetAntwort(UUID id, String name, String kuerzel) {

	public static FakultaetAntwort aus(Fakultaet fakultaet) {
		return new FakultaetAntwort(fakultaet.getId(), fakultaet.getName(), fakultaet.getKuerzel());
	}
}
