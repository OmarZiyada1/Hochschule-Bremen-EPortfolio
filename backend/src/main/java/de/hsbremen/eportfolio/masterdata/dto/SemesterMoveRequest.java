package de.hsbremen.eportfolio.masterdata.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * Body von {@code POST /api/admin/semesters/{id}/move} (§6.1, §3.18).
 *
 * <p><strong>Eine Zeile statt einer Gesamtreihenfolge.</strong> Die
 * Administrationsseite bietet je Zeile zwei Pfeile an; ein Endpoint, der die
 * vollstaendige Liste entgegennimmt, wuerde die Umsortierung einer zweiten
 * Admin-Person stillschweigend ueberschreiben, weil der Client seine Sicht von
 * vor dem Klick zurueckschickt. Der Tausch mit der Nachbarzeile ist dagegen in
 * sich abgeschlossen.
 *
 * <p><strong>Am Rand ist die Aktion wirkungslos und ergibt trotzdem 200.</strong>
 * Ein Fehler waere hier irrefuehrend: der gewuenschte Zustand besteht bereits.
 *
 * @param direction Richtung des Tauschs
 */
public record SemesterMoveRequest(

		@Schema(description = "Richtung: UP tauscht mit der Zeile darueber, DOWN mit der "
				+ "darunter.", example = "UP")
		@NotNull(message = "Richtung fehlt.")
		MoveDirection direction) {

	/**
	 * Die beiden Richtungen der Pfeile.
	 *
	 * <p>Liegt bewusst hier und nicht in {@code common/enums}: dort stehen die
	 * fachlichen Enums aus Contract §2, die als Spalte in der Datenbank landen.
	 * Diese Angabe beschreibt eine Bewegung im Request und wird nirgends
	 * gespeichert.
	 */
	public enum MoveDirection {
		UP,
		DOWN
	}
}
