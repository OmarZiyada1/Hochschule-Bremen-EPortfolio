package de.hsbremen.eportfolio.stammdaten.dto;

import de.hsbremen.eportfolio.stammdaten.Kategorie;
import java.util.UUID;

/**
 * Eine Kategorie in der Antwort von {@code GET /api/kategorien} (§6.1).
 *
 * <p>Eigenes Record und keine serialisierte Entity — aus demselben Grund wie bei
 * {@code BenutzerAntwort}: was die API ausliefert, soll an einer Stelle stehen
 * und sich nicht aendern, sobald jemand der Entity ein Feld hinzufuegt.
 *
 * @param id   technischer Schluessel; das Frontend schickt ihn beim Anlegen
 *             eines Projekts zurueck
 * @param name Anzeigename, in {@code kategorie.name} eindeutig
 */
public record KategorieAntwort(UUID id, String name) {

	public static KategorieAntwort aus(Kategorie kategorie) {
		return new KategorieAntwort(kategorie.getId(), kategorie.getName());
	}
}
