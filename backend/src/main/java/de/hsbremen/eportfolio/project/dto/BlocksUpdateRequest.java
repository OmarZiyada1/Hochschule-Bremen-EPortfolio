package de.hsbremen.eportfolio.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

/**
 * Body von {@code PUT /api/projects/{id}/blocks} (§6.1): der Autosave-Pfad des
 * Editors.
 *
 * <p><strong>Die Liste ersetzt den gesamten Inhalt</strong> und wird als eine
 * Transaktion ausgefuehrt. Ein Block mit bekannter {@code id} wird
 * aktualisiert, einer ohne {@code id} neu angelegt, und ein Block, der nicht
 * mehr in der Liste steht, geloescht. Ohne dieses Upsert-Verhalten bekaeme jeder
 * Block bei jedem Autosave-Takt eine neue UUID; blockbezogene Kommentare waeren
 * damit dauerhaft unmoeglich (§6.1, „Stabile Block-IDs").
 *
 * <p><strong>Warum der Inhalt einen eigenen Endpoint hat</strong> und nicht in
 * {@code PUT /projects/{id}} steckt: der Editor speichert zeitversetzt und
 * automatisch. Eine gemeinsame Ressource wuerde bei jedem Tastenanschlag auch
 * die Metadaten mitschreiben und Aenderungen an ihnen ueberschreiben (§6.1).
 *
 * <p><strong>Ersetzende Semantik ohne Ausnahme.</strong> Anders als bei
 * {@link ProjectUpdateRequest} bedeutet {@code blocks: []} hier nicht „nicht
 * anfassen", sondern „der Beitrag hat keinen Inhalt mehr". Das Feld ist Pflicht:
 * ein Autosave ohne Inhaltsliste hat keine Bedeutung, die sich von einer leeren
 * unterscheiden liesse.
 *
 * @param version Stand aus {@code GET /projects/{id}/blocks} oder aus der
 *                vorigen Antwort dieses Endpoints. Weicht er vom Stand in der
 *                Datenbank ab, folgt <strong>409</strong>
 *                {@code PROJECT_VERSION_CONFLICT} (§6.4)
 * @param blocks  vollstaendige neue Blockliste, {@code orderIndex} lueckenlos
 *                ab 0
 */
public record BlocksUpdateRequest(
		@Schema(description = "Stand fuer Optimistic Locking, unveraendert aus der vorigen "
				+ "Antwort uebernommen (§6.4).", example = "3")
		@NotNull(message = "version fehlt. Sie gehoert in den Body jedes schreibenden Requests "
				+ "(§6.4).")
		Long version,

		@Schema(description = "Vollstaendige neue Blockliste. Sie ersetzt den bisherigen Inhalt; "
				+ "[] loescht ihn. Bloecke mit id werden aktualisiert, Bloecke ohne id neu "
				+ "angelegt.")
		@NotNull(message = "blocks fehlt. Zum Loeschen des Inhalts die leere Liste [] schicken.")
		@Valid
		List<BlockRequest> blocks) {
}
