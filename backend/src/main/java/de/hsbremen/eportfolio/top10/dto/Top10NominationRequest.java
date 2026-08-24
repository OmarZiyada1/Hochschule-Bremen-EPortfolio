package de.hsbremen.eportfolio.top10.dto;

import de.hsbremen.eportfolio.common.enums.NominationTier;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * Body von {@code POST /api/projects/{id}/top10-nomination} (§6.1).
 *
 * <p><strong>Seit Contract v68 traegt der Body die Stufe und nicht mehr den
 * Platz.</strong> Bis dahin stand hier ein optionales {@code proposedPosition}.
 * Das setzte Kenntnis der gesamten Liste voraus, die eine Redakteur:in beim
 * Nominieren nicht hat: sie sieht ein Projekt und beurteilt es, sie sieht nicht,
 * was auf Platz 3 steht. Entsprechend blieb das Feld meist leer, und die
 * Administration entschied ohnehin neu. Die Stufe (§2.13) ist die Aussage, die
 * die Redaktion tatsaechlich treffen kann, und deshalb ist sie Pflicht.
 *
 * <p><strong>Der Vorschlag bleibt unverbindlich.</strong> Er wird gespeichert
 * und in der Admin-Ansicht angezeigt, entscheidet aber nichts: den Platz nennt
 * der Body von {@code POST /api/admin/top10-nominations/{id}/accept}, und der
 * Server prueft nicht, ob er in den Bereich der Stufe faellt (§3.11.1 Regel 4).
 * Eine Bindung zwaenge die Administration, einen als {@code TOP_1}
 * vorgeschlagenen Beitrag erst abzulehnen, um ihn auf Platz 4 zu setzen.
 * Entschieden in der Klaerungsrunde zu KAN-37.
 *
 * <p><strong>Der Body ist damit nicht mehr optional.</strong> Ein {@code POST}
 * ohne Koerper endet mit <strong>400</strong> {@code VALIDATION_FAILED}, und
 * das ist richtig so: ohne Stufe fehlt die einzige Angabe, die der Vorschlag
 * traegt.
 *
 * @param proposedTier vorgeschlagene Stufe, Pflichtangabe
 */
public record Top10NominationRequest(

		@Schema(description = "Vorgeschlagene Stufe (§2.13). Pflichtangabe. TOP_1 meint den "
				+ "Spitzenplatz, TOP_5 die Plaetze 2 bis 5, TOP_10 die Plaetze 6 bis 10. "
				+ "Ueber den tatsaechlichen Platz entscheidet die Administration beim "
				+ "Annehmen; die Stufe bindet sie nicht.",
				example = "TOP_5", requiredMode = Schema.RequiredMode.REQUIRED)
		@NotNull(message = "Bitte eine Stufe waehlen: TOP_1, TOP_5 oder TOP_10.")
		NominationTier proposedTier) {
}
