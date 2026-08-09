package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Body von {@code POST /api/admin/categories/{id}/merge} (§6.1, §3.6, KAN-46):
 * die Kategorie, in der die Quelle aufgehen soll.
 *
 * <p><strong>Warum es diesen Endpoint ueberhaupt gibt.</strong> §6.1 sperrt das
 * Loeschen einer noch referenzierten Kategorie mit 409 {@code RESOURCE_IN_USE},
 * damit Projekte ihre Klassifikation nicht ohne Vorwarnung verlieren. Genau
 * dadurch war eine versehentlich doppelt angelegte Kategorie bisher nicht mehr
 * aufraeumbar: loeschen ist gesperrt, und umhaengen liess sich die Projekte
 * nirgends. Das Zusammenfuehren ist der fehlende dritte Weg neben Anlegen und
 * Loeschen.
 *
 * <p><strong>Die Richtung steht im Pfad, nicht im Body.</strong> Die ID im Pfad
 * ist die Quelle und verschwindet, die ID im Body ist das Ziel und bleibt. So
 * traegt der Pfad wie bei {@code DELETE /admin/categories/{id}} die Zeile, die
 * am Ende nicht mehr da ist, und beide Endpoints lesen sich gleich.
 *
 * <p><strong>Eine unbekannte {@code targetCategoryId} ergibt 400</strong>
 * {@code VALIDATION_FAILED} und nicht 404. §6.1 legt das fuer jede unbekannte ID
 * im Body fest: sie ist keine Aussage ueber einen Zustand, sondern eine
 * unbrauchbare Anfrage. Der 404 bleibt der unbekannten ID im <em>Pfad</em>
 * vorbehalten, also der Quellkategorie (§6.3.1). Dieselbe Abgrenzung gilt seit
 * KAN-25 fuer {@code facultyId} und {@code studyProgramId}.
 *
 * @param targetCategoryId Zielkategorie, an die alle Projekte der Quelle
 *                         umgehaengt werden. Sie bleibt bestehen, die Quelle
 *                         wird geloescht
 */
public record CategoryMergeRequest(

		@Schema(description = "ID der Zielkategorie. Alle Projekte der Kategorie aus dem Pfad "
				+ "werden auf sie umgehaengt, danach wird die Quelle geloescht. Eine unbekannte "
				+ "ID ergibt 400, dieselbe ID wie im Pfad ebenfalls.",
				example = "3f2504e0-4f89-11d3-9a0c-0305e82c3301")
		@NotNull(message = "targetCategoryId fehlt. Ohne Ziel gibt es nichts, worin die Quelle "
				+ "aufgehen koennte.")
		UUID targetCategoryId) {
}
