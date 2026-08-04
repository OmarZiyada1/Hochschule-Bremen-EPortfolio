package de.hsbremen.eportfolio.comment.dto;

import de.hsbremen.eportfolio.common.enums.CommentStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * Body von {@code PATCH /api/comments/{id}/status} (§6.1): der Erledigungsstand
 * eines Aenderungswunsches.
 *
 * <p><strong>Umgeschaltet wird von der Projektseite</strong>, also von der
 * Autor:in und den Projektmitgliedern, nicht von der Redaktion (§2.4). Wer die
 * Aenderung umsetzt, weiss am besten, wann sie umgesetzt ist. Laege das
 * Umschalten allein bei der Redaktion, entstuende eine Warteschleife: die
 * Studierenden haetten gearbeitet, koennten das aber nicht signalisieren. Die
 * Kontrolle ueber das Ergebnis bleibt trotzdem bei der Redaktion, weil sie beim
 * erneuten Einreichen ohnehin prueft. Gesperrt sind Redaktion und
 * Administration deshalb nicht: die Zeile „CHANGE_REQUEST-Status setzen" in §5
 * traegt in beiden Spalten einen vollen Haken. Wie die drei Stellen zusammen zu
 * lesen sind, steht an {@code CommentService.updateStatus}.
 *
 * <p><strong>Beide Richtungen sind erlaubt</strong>, {@code OPEN} nach
 * {@code RESOLVED} und zurueck. §2.4 beschreibt die beiden Werte als Zustand
 * und nicht als Einbahnstrasse; ein versehentlich abgehakter Punkt liesse sich
 * sonst nur ueber einen neuen Kommentar der Redaktion wieder oeffnen. Ein
 * Aufruf, der den bereits gesetzten Wert schickt, ist kein Fehler, sondern
 * wirkungslos.
 *
 * @param status der neue Erledigungsstand (§2.4)
 */
public record CommentStatusRequest(
		@Schema(description = "Neuer Erledigungsstand des Aenderungswunsches: OPEN, solange er "
				+ "offen ist, RESOLVED, wenn die Projektseite ihn als erledigt markiert (§2.4).",
				example = "RESOLVED")
		@NotNull(message = "status fehlt. Zulaessig sind OPEN und RESOLVED (§2.4).")
		CommentStatus status) {
}
