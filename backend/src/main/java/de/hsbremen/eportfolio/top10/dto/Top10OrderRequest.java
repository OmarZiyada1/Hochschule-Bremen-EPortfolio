package de.hsbremen.eportfolio.top10.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Body von {@code PUT /api/admin/top10} (§6.1, §3.11.1 Regel 3).
 *
 * <p><strong>Der Array-Index ist der Platz.</strong> Das erste Element steht auf
 * Platz 1. Einen zusaetzlichen {@code position}-Parameter gibt es hier
 * ausdruecklich nicht, weil Reihenfolge und explizite Positionsangabe einander
 * widersprechen koennten und dann niemand wuesste, welche von beiden gilt
 * (§3.11.1).
 *
 * <p><strong>Der Aufruf ersetzt die Liste vollstaendig.</strong> Was nicht in
 * {@code projectIds} steht, ist danach nicht mehr in der Top-10. Eine leere
 * Liste leert sie also; das ist kein Sonderfall, sondern die Konsequenz aus
 * „ersetzt vollstaendig", und ein eigener Endpoint zum Leeren waere derselbe
 * Vorgang unter anderem Namen.
 *
 * <p><strong>Die Plaetze sind danach lueckenlos</strong> 1 bis n. Luecken
 * entstehen erst spaeter, wenn ein Projekt {@code PUBLISHED} verlaesst und
 * seinen Platz raeumt; dieser Endpoint ist der einzige, der neu durchnummeriert.
 *
 * @param projectIds die Projekte in der gewuenschten Reihenfolge, hoechstens
 *                   zehn
 */
public record Top10OrderRequest(

		@Schema(description = "Projekte in der gewuenschten Reihenfolge; der Index bestimmt den "
				+ "Platz, das erste Element steht auf Platz 1. Hoechstens zehn Eintraege, keine "
				+ "Wiederholungen, ausschliesslich veroeffentlichte Projekte. Eine leere Liste "
				+ "leert die Top-10.",
				requiredMode = Schema.RequiredMode.REQUIRED)
		@NotNull(message = "projectIds ist Pflicht; eine leere Liste leert die Top-10.")
		@Size(max = 10, message = "Die Top-10 fasst hoechstens zehn Projekte.")
		List<UUID> projectIds) {
}
