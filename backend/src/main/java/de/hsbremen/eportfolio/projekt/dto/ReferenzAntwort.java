package de.hsbremen.eportfolio.projekt.dto;

import de.hsbremen.eportfolio.stammdaten.Fakultaet;
import de.hsbremen.eportfolio.stammdaten.Kategorie;
import de.hsbremen.eportfolio.stammdaten.Modul;
import de.hsbremen.eportfolio.stammdaten.Studiengang;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Stammdatenbezug eines Projekts: Kategorie, Fakultaet, Studiengang oder
 * Modul (§3.6 bis §3.9).
 *
 * <p>Ein gemeinsames Record fuer alle vier, weil die Projektantwort von ihnen
 * genau dasselbe braucht: die ID zum Weiterfiltern und einen anzeigbaren Namen.
 * Vier fast gleiche Records wuerden das Frontend zwingen, viermal denselben
 * Baustein zu bauen. Die vollstaendigen Stammdaten samt ihrer Hierarchie
 * liefern weiterhin die Endpoints aus §6.1 (Stammdaten).
 *
 * <p>Alle Bezuege sind am Projekt <em>nullable</em> (§3.3): im {@code ENTWURF}
 * duerfen sie fehlen, Pflicht werden sie erst beim Einreichen.
 *
 * @param id      ID der Stammdatenzeile, zugleich Filterwert von
 *                {@code GET /api/projekte}
 * @param name    ausgeschriebener Name
 * @param kuerzel Kurzform; bei der Kategorie gibt es keine, dort immer
 *                {@code null}
 */
public record ReferenzAntwort(
		UUID id,

		String name,

		@Schema(description = "Kurzform, z. B. \"FK4\". Fehlt bei Kategorien und kann "
				+ "auch bei Studiengang und Modul null sein.", nullable = true)
		String kuerzel) {

	/** Die Kategorie fuehrt kein Kuerzel (§3.6). */
	public static ReferenzAntwort aus(Kategorie kategorie) {
		if (kategorie == null) {
			return null;
		}
		return new ReferenzAntwort(kategorie.getId(), kategorie.getName(), null);
	}

	public static ReferenzAntwort aus(Fakultaet fakultaet) {
		if (fakultaet == null) {
			return null;
		}
		return new ReferenzAntwort(fakultaet.getId(), fakultaet.getName(), fakultaet.getKuerzel());
	}

	public static ReferenzAntwort aus(Studiengang studiengang) {
		if (studiengang == null) {
			return null;
		}
		return new ReferenzAntwort(studiengang.getId(), studiengang.getName(), studiengang.getKuerzel());
	}

	public static ReferenzAntwort aus(Modul modul) {
		if (modul == null) {
			return null;
		}
		return new ReferenzAntwort(modul.getId(), modul.getName(), modul.getKuerzel());
	}
}
