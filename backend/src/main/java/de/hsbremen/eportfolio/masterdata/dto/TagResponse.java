package de.hsbremen.eportfolio.masterdata.dto;

import de.hsbremen.eportfolio.masterdata.TagUsageCount;
import io.swagger.v3.oas.annotations.media.Schema;
import java.util.UUID;

/**
 * Ein Schlagwort in der Antwort von {@code GET /api/tags} (§6.1, §3.19).
 *
 * <p>Eigenes Record und keine serialisierte Entity, aus demselben Grund wie bei
 * {@link CategoryResponse}.
 *
 * <p><strong>{@code usageCount} steht dabei, weil die Reihenfolge sonst
 * unerklaerlich waere.</strong> Die Vorschlagsliste ordnet nach Haeufigkeit; ohne
 * die Zahl saehe der aufrufende Client eine Reihenfolge, die er weder
 * nachvollziehen noch selbst herstellen kann. Sie zaehlt ueber alle
 * Projektstatus und verraet nichts ueber einzelne Projekte.
 *
 * <p><strong>Die {@code id} benutzt das Auswahlfeld nicht.</strong> Projekte
 * fuehren ihre Tags in Anfrage und Antwort weiterhin als Namen (§3.3), die
 * Combobox gibt also Namen zurueck. Die ID steht trotzdem in der Antwort: sie
 * ist der stabile Schluessel fuer die Tag-Verwaltung der Administrationsseite,
 * die umbenennen und zusammenfuehren koennen muss, und eine Liste ohne
 * Schluessel muesste dafuer spaeter erweitert werden.
 *
 * @param id         technischer Schluessel des Tags
 * @param name       Anzeigename in der gespeicherten Schreibweise; eindeutig
 *                   ueber {@code lower(name)}
 * @param usageCount Zahl der Projekte mit diesem Tag
 */
public record TagResponse(
		UUID id,

		String name,

		@Schema(description = "Zahl der Projekte mit diesem Tag, ueber alle Projektstatus "
				+ "gezaehlt. Bestimmt die Reihenfolge der Vorschlaege; ein Tag, dessen "
				+ "letztes Projekt geloescht wurde, bleibt mit 0 stehen.", example = "12")
		long usageCount) {

	public static TagResponse from(TagUsageCount usage) {
		return new TagResponse(usage.id(), usage.name(), usage.count());
	}
}
