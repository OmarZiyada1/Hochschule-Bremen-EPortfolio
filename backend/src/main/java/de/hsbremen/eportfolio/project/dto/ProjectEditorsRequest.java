package de.hsbremen.eportfolio.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.Set;
import java.util.UUID;

/**
 * Body von {@code PUT /api/projects/{id}/editors} (§6.1): „Redaktion
 * umverteilen, jederzeit und unabhaengig vom Status", Rolle ADMIN.
 *
 * <p><strong>Warum es diesen Endpoint neben dem Feld {@code editorIds} in
 * {@code PUT /projects/{id}} gibt.</strong> Die Autor:in waehlt die Redaktion
 * bei der Anlage und kann sie aendern, solange das Projekt in {@code DRAFT}
 * oder {@code REVISION} steht (§5, Fussnote ³). Genau
 * dann, wenn es darauf ankommt, ist dieser Weg aber zu: sobald ein Projekt
 * eingereicht ist, sind die Metadaten gesperrt (§4.1). Faellt eine Betreuung
 * aus, waere ein eingereichtes Projekt ohne diesen Endpoint dauerhaft
 * unbearbeitbar. Deshalb ist er statusunabhaengig und deshalb ist er
 * Admin-only.
 *
 * <p><strong>Kein {@code version}-Feld.</strong> §6.4 verlangt es „bei jedem
 * schreibenden Request", gemeint ist aber der Schutz vor stillem Datenverlust
 * beim gemeinsamen Bearbeiten. Hier schreibt niemand ausser der Administration,
 * und ihre Zuweisung soll nicht daran scheitern, dass die Projektseite
 * zwischenzeitlich einen Titel korrigiert hat. Die beiden Aenderungen betreffen
 * verschiedene Felder und koennen einander nicht ueberschreiben.
 *
 * @param editorIds vollstaendige neue Liste der zustaendigen Redakteur:innen.
 *                  Sie ersetzt die bisherige; {@code []} hebt die Zuweisung auf
 */
public record ProjectEditorsRequest(
		@Schema(description = "IDs der zustaendigen Redakteur:innen aus "
				+ "GET /api/users/lookup?role=EDITOR. Die Liste ersetzt die bisherige "
				+ "vollstaendig; [] hebt die Zuweisung auf. Anders als bei "
				+ "PUT /api/projects/{id} ist das Feld hier Pflicht, weil dieser Endpoint "
				+ "nichts anderes tut. Auch hier gilt der Ausschluss aus §5 Fussnote 3 "
				+ "(seit Contract v61): eine Person, die zur Projektseite gehoert, also "
				+ "Autor:in oder Projektmitglied, wird nicht neu als Redaktion eingetragen, "
				+ "sonst 400 VALIDATION_FAILED. Eine bereits bestehende Ueberschneidung laesst "
				+ "sich weiterhin aufloesen.")
		@NotNull(message = "editorIds fehlt.")
		Set<UUID> editorIds) {
}
