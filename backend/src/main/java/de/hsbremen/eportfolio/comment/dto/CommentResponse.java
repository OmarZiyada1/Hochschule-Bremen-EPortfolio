package de.hsbremen.eportfolio.comment.dto;

import de.hsbremen.eportfolio.comment.Comment;
import de.hsbremen.eportfolio.common.enums.CommentStatus;
import de.hsbremen.eportfolio.common.enums.CommentType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * Ein Kommentar in der Antwort von {@code GET /api/projects/{id}/comments} und
 * den drei schreibenden Kommentar-Endpoints (§3.5, §6.1).
 *
 * <p><strong>Die Liste ist serverseitig gefiltert.</strong> Ein Kommentar vom
 * Typ {@code NOTE} erreicht Studierende nicht als ausgeblendetes Feld, sondern
 * gar nicht: er wird schon in der Abfrage ausgeschlossen (§2.3,
 * {@code CommentService.list}). Eine Filterung erst im Frontend waere ueber
 * einen direkten API-Aufruf auslesbar und die Vertraulichkeit der internen
 * Notiz damit nur scheinbar gegeben.
 *
 * <p><strong>Ohne {@code projectId}.</strong> Der Bezug steht bei allen fuenf
 * Endpoints bereits fest: die Liste haengt am Projektpfad, und wer einen
 * einzelnen Kommentar aendert, hat ihn von dort. Ein Feld, das in jeder Antwort
 * denselben Wert traegt, den der Aufrufer selbst geschickt hat, sagt nichts.
 *
 * @param id        ID des Kommentars, zugleich Pfadwert von
 *                  {@code PATCH} und {@code DELETE /api/comments/{id}}
 * @param author    Verfasser:in samt Rolle
 * @param type      Art des Kommentars (§2.3)
 * @param text      der Kommentartext
 * @param status    Erledigungsstand, ausschliesslich bei
 *                  {@code type = CHANGE_REQUEST} gesetzt, sonst {@code null}
 *                  (§2.4, §3.5)
 * @param createdAt Anlagezeitpunkt, zugleich das Sortierkriterium der Liste
 * @param updatedAt Zeitpunkt der letzten Textaenderung
 */
public record CommentResponse(
		UUID id,

		CommentAuthorResponse author,

		CommentType type,

		String text,

		@Schema(description = "Erledigungsstand eines Aenderungswunsches (OPEN oder RESOLVED). "
				+ "Nur bei type = CHANGE_REQUEST gesetzt, bei REPLY und NOTE null (§2.4).",
				nullable = true)
		CommentStatus status,

		Instant createdAt,

		Instant updatedAt) {

	public static CommentResponse from(Comment comment) {
		return new CommentResponse(
				comment.getId(),
				CommentAuthorResponse.from(comment.getAuthor()),
				comment.getType(),
				comment.getText(),
				comment.getStatus(),
				comment.getCreatedAt(),
				comment.getUpdatedAt());
	}
}
