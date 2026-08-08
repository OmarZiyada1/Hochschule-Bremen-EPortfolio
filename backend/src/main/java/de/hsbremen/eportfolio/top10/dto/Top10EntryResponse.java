package de.hsbremen.eportfolio.top10.dto;

import de.hsbremen.eportfolio.project.dto.ProjectCardResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Ein Platz der kuratierten Top-10 in der Antwort von {@code GET /api/top10}
 * (§3.11, §6.1).
 *
 * <p><strong>Die Kachel ist dieselbe wie in der Projektliste.</strong> §6.1
 * fordert fuer diese Zeile ausdruecklich „die Projektkachel"; ein eigenes,
 * schmaleres Projekt-DTO daneben muesste bei jeder Aenderung an
 * {@link ProjectCardResponse} mitgezogen werden, und die Startseite zeigt die
 * Top-10 ohnehin in derselben Darstellung wie die Galerie darunter.
 *
 * <p><strong>Die Liste hat Luecken und ist keine dichte Rangfolge.</strong>
 * {@code position} ist ein Platz zwischen 1 und 10, nicht der Index in dieser
 * Antwort: wird ein Projekt von Platz 4 zurueckgezogen, liefert der Endpoint
 * anschliessend die Plaetze 1, 2, 3, 5 und so weiter. Der freie Platz wird
 * bewusst nicht durch Nachruecken geschlossen, weil ein Projekt sonst durch eine
 * Entscheidung der Redaktion einen anderen Platz bekaeme, ohne dass der Admin
 * das kuratiert haette. Die Oberflaeche stellt einen unbesetzten Platz als
 * Platzhalter dar (KAN-31); die Antwort erfindet dafuer keine leeren Eintraege,
 * weil sie sonst zu jedem Platzhalter eine Kachel ohne Projekt fuehren muesste.
 *
 * @param position Platz 1 bis 10 (§3.11)
 * @param addedAt  Zeitpunkt der Aufnahme in die Liste. Bleibt beim Umsortieren
 *                 ueber {@code PUT /api/admin/top10} stehen, weil eine
 *                 Umsortierung keine Aufnahme ist
 * @param project  die Projektkachel, wie sie auch {@code GET /api/projects}
 *                 liefert
 */
public record Top10EntryResponse(

		@Schema(description = "Platz in der Top-10, 1 bis 10. Nicht der Index in dieser Liste: "
				+ "unbesetzte Plaetze fehlen, es kann also eine Luecke geben.", example = "1")
		int position,

		@Schema(description = "Zeitpunkt der Aufnahme in die Liste, nicht der letzten "
				+ "Umsortierung.")
		Instant addedAt,

		ProjectCardResponse project) {
}
