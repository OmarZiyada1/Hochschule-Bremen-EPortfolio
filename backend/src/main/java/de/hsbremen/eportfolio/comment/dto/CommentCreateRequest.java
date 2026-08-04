package de.hsbremen.eportfolio.comment.dto;

import de.hsbremen.eportfolio.common.enums.CommentType;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code POST /api/projects/{id}/comments} (§6.1).
 *
 * <p><strong>Kein {@code status} im Body.</strong> Ein
 * {@code CHANGE_REQUEST} startet immer in {@code OPEN}, {@code REPLY} und
 * {@code NOTE} tragen ueberhaupt keinen Status (§2.4, §3.5). Der Wert folgt
 * damit vollstaendig aus {@code type} und waere als Eingabefeld nur die
 * Gelegenheit, einen Arbeitsauftrag im selben Zug anzulegen und abzuhaken.
 * Umgeschaltet wird er spaeter ueber
 * {@code PATCH /api/comments/{id}/status}, und zwar von der Projektseite.
 *
 * <p><strong>Warum {@code type} hier ein Enum ist</strong> und nicht wie in
 * {@code BlockRequest} ein {@code String}: dort gibt es fuer den unbekannten
 * Wert mit {@code BLOCK_TYPE_UNKNOWN} einen eigenen Fehlercode, der bei einer
 * gescheiterten JSON-Umwandlung nie zum Zuge kaeme. Fuer den Kommentartyp
 * fuehrt §6.2 keinen solchen Code; ein Wert ausserhalb von §2.3 ergibt also so
 * oder so <strong>400</strong> {@code VALIDATION_FAILED}, und dann ist das
 * Enum die ehrlichere Signatur. Es steht ausserdem in der OpenAPI-Beschreibung
 * mit seinen drei zulaessigen Werten.
 *
 * @param type Art des Kommentars (§2.3). Welche Werte zulaessig sind, haengt an
 *             der Rolle: {@code NOTE} und {@code CHANGE_REQUEST} bleiben
 *             Redaktion und Administration vorbehalten (§5)
 * @param text der Kommentartext
 */
public record CommentCreateRequest(
		@Schema(description = "Art des Kommentars (§2.3). REPLY ist die flache Rueckmeldung, NOTE "
				+ "die interne Notiz der Redaktion, CHANGE_REQUEST der Aenderungswunsch mit "
				+ "Erledigungsstatus. NOTE und CHANGE_REQUEST duerfen nur EDITOR und ADMIN "
				+ "anlegen (§5).",
				example = "REPLY")
		@NotNull(message = "type fehlt. Zulaessig sind REPLY, NOTE und CHANGE_REQUEST (§2.3).")
		CommentType type,

		@Schema(description = "Der Kommentartext.",
				example = "Die Gliederung ist schluessig, danke.")
		@NotBlank(message = "text fehlt. Ein Kommentar ohne Text sagt nichts.")
		@Size(max = 5000, message = "text ist zu lang (hoechstens 5000 Zeichen).")
		String text) {
}
