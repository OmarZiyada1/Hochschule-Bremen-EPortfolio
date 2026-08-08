package de.hsbremen.eportfolio.top10.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * Body von {@code POST /api/projects/{id}/top10-nomination} (§6.1).
 *
 * <p><strong>Das einzige Feld ist optional</strong>, der ganze Body damit auch.
 * §3.11 fuehrt {@code proposedPosition} als _nullable_: eine Redakteur:in
 * schlaegt in erster Linie ein Projekt vor und nicht einen Platz. Wer keine
 * Vorstellung von der Reihenfolge hat, soll trotzdem nominieren koennen.
 *
 * <p><strong>Der Vorschlag ist unverbindlich.</strong> Er wird gespeichert und in
 * der Admin-Ansicht angezeigt, entscheidet aber nichts: der Platz kommt aus dem
 * Body von {@code POST /api/admin/top10-nominations/{id}/accept}. Deshalb wird
 * hier auch nicht geprueft, ob die vorgeschlagene Position gerade frei ist. Zum
 * Zeitpunkt des Vorschlags kann das niemand wissen, und ein 409 auf einen
 * Wunsch, der ohnehin niemanden bindet, waere eine Huerde ohne Zweck.
 *
 * @param proposedPosition gewuenschter Platz 1 bis 10, darf fehlen
 */
public record Top10NominationRequest(

		@Schema(description = "Unverbindlicher Platzvorschlag, 1 bis 10. Darf fehlen; "
				+ "ueber den tatsaechlichen Platz entscheidet die Administration beim Annehmen.",
				example = "3", nullable = true)
		@Min(value = 1, message = "Der Platzvorschlag liegt zwischen 1 und 10.")
		@Max(value = 10, message = "Der Platzvorschlag liegt zwischen 1 und 10.")
		Integer proposedPosition) {

	/**
	 * Ein leerer Vorschlag, fuer den Fall, dass der Client gar keinen Body
	 * schickt.
	 *
	 * <p>Ohne diesen Ersatz muesste der Controller den Body als Pflichtfeld
	 * fuehren, obwohl sein einziges Feld optional ist: ein {@code POST} ohne
	 * Koerper endete sonst mit 400 {@code VALIDATION_FAILED} aus
	 * {@code handleUnreadableBody}, und die einfachste Form der Nominierung waere
	 * ausgerechnet die, die nicht funktioniert.
	 */
	public static Top10NominationRequest empty() {
		return new Top10NominationRequest(null);
	}
}
