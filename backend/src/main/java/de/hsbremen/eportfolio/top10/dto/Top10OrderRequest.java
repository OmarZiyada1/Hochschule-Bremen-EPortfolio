package de.hsbremen.eportfolio.top10.dto;

import io.swagger.v3.oas.annotations.media.ArraySchema;
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
 * <p><strong>Ein {@code null}-Eintrag heisst „Platz frei"</strong> (seit
 * Contract v78, KAN-40). Der Index bleibt der Platz: {@code [A, null, C]} setzt
 * A auf 1 und C auf 3 und laesst 2 unbesetzt. Freie Plaetze kennt §3.11
 * laengst, sie entstehen beim Entzug eines Platzes und werden bewusst nicht
 * aufgefuellt; herstellen konnte die Administration einen aber bis v77
 * nirgends, denn dieser Endpoint nummerierte immer lueckenlos ab 1 durch.
 *
 * <p><strong>Eine Liste ohne {@code null} verhaelt sich unveraendert</strong>,
 * sie wird also weiterhin lueckenlos ab 1 durchnummeriert; nur wer eine Luecke
 * will, muss sie ausdruecklich nennen. Nachlaufende {@code null}-Eintraege
 * schneidet der Server ab, weil ein freier Platz hinter dem letzten Projekt
 * dasselbe ist wie kein Platz.
 *
 * <p><strong>Der Aufruf ersetzt die Liste vollstaendig.</strong> Was nicht in
 * {@code projectIds} steht, ist danach nicht mehr in der Top-10. Eine leere
 * Liste leert sie also; das ist kein Sonderfall, sondern die Konsequenz aus
 * „ersetzt vollstaendig", und ein eigener Endpoint zum Leeren waere derselbe
 * Vorgang unter anderem Namen.
 *
 * <p><strong>Die Obergrenze von zehn zaehlt die Eintraege der Liste, nicht die
 * Projekte darin:</strong> eine Liste aus zehn Eintraegen mit drei {@code null}
 * vergibt sieben Plaetze. Anders gezaehlt entstuende ein elfter Platz, denn der
 * Index des letzten Eintrags ist seine Position, und die laesst der
 * Check-Constraint {@code ck_top10_entry_position} nicht zu. Deshalb steht
 * {@code @Size} an der Liste und nicht an den genannten Projekten.
 *
 * <p><strong>Wiederholungen bleiben verboten, {@code null} nicht.</strong>
 * Geprueft wird die Eindeutigkeit unter den genannten Projekten; ein freier
 * Platz benennt kein Projekt und darf deshalb beliebig oft vorkommen.
 *
 * <p><strong>Warum {@code @ArraySchema} und nicht {@code @Schema(nullable =
 * true)}.</strong> Nullbar sind die <em>Eintraege</em> und nicht die Liste, und
 * genau das trennt {@code @ArraySchema}: {@code schema} beschreibt den Eintrag,
 * {@code arraySchema} die Liste. Ein {@code @Schema(nullable = true)} am
 * Listenfeld traefe beide, und der Haken
 * {@code nullableReferencePropertyCustomizer} in {@code OpenApiConfig} nimmt die
 * Angabe den Eintraegen dort ausdruecklich wieder weg (KAN-74, Hausregel „eine
 * Liste kann null sein, ein Eintrag darin nie"). Im OpenAPI-Dokument stuende
 * dann {@code items: {type: string}}, und {@code openapi-typescript} erzeugte im
 * Frontend weiterhin {@code string[]} statt {@code (string | null)[]}.
 *
 * @param projectIds die Plaetze in der gewuenschten Reihenfolge, hoechstens
 *                   zehn Eintraege; {@code null} laesst den jeweiligen Platz
 *                   frei
 */
public record Top10OrderRequest(

		@ArraySchema(
				arraySchema = @Schema(description = "Plaetze in der gewuenschten Reihenfolge; der "
						+ "Index bestimmt den Platz, das erste Element steht auf Platz 1. Ein "
						+ "null-Eintrag laesst den Platz frei (seit Contract v78): [A, null, C] "
						+ "setzt A auf 1 und C auf 3. Nachlaufende null-Eintraege schneidet der "
						+ "Server ab. Hoechstens zehn Eintraege, freie Plaetze zaehlen mit. Keine "
						+ "Wiederholungen, ausschliesslich veroeffentlichte Projekte; null darf "
						+ "beliebig oft vorkommen. Eine leere Liste leert die Top-10.",
						requiredMode = Schema.RequiredMode.REQUIRED),
				schema = @Schema(description = "ID eines veroeffentlichten Projekts, oder null fuer "
						+ "einen freien Platz.",
						nullable = true))
		@NotNull(message = "projectIds ist Pflicht; eine leere Liste leert die Top-10.")
		@Size(max = 10, message = "Die Top-10 fasst hoechstens zehn Eintraege; freie Plaetze "
				+ "zaehlen mit.")
		List<UUID> projectIds) {
}
