package de.hsbremen.eportfolio.reaction.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Antwort der beiden Reaktions-Endpoints aus §6.1: {@code POST} und
 * {@code DELETE /api/projects/{id}/reaction} liefern beide <strong>200</strong>
 * mit {@code { count }}.
 *
 * <p><strong>Warum die Endpoints ueberhaupt etwas zurueckgeben.</strong> Die
 * Oberflaeche zeigt den Zaehler unmittelbar am Knopf. Ohne diese Antwort
 * muesste der Client nach jedem Klick die Kachel oder das ganze Projekt neu
 * laden, nur um eine Zahl zu erfahren, die der Server gerade selbst berechnet
 * hat (§6.1).
 *
 * <p><strong>Warum genau ein Feld.</strong> Ob die angemeldete Person selbst
 * reagiert hat, steht bewusst nicht darin: nach einem {@code POST} hat sie es,
 * nach einem {@code DELETE} nicht, die Antwort auf die Frage folgt also schon
 * aus der Aktion. Offen bleibt der Zustand beim ersten Laden einer Seite, an
 * dem keiner der beiden Endpoints beteiligt ist. Diese Luecke gehoert nicht
 * hierher, sondern in die Projektantworten aus §6.1, und ist als offener Punkt
 * in KAN-21 festgehalten.
 *
 * <p><strong>Kein gecachtes Zaehlerfeld.</strong> {@code count} ist immer der
 * {@code COUNT} ueber die Reaktionszeilen (§3.10), dieselbe Quelle wie
 * {@code reactionCount} in Kachel und Detail. Eine mitgefuehrte Zahl an der
 * Projektzeile koennte davon abweichen, und zwar genau dann, wenn zwei Personen
 * gleichzeitig reagieren.
 *
 * @param count Zahl der Reaktionen des Projekts nach dieser Aenderung
 */
public record ReactionResponse(

		@Schema(description = "Zahl der Reaktionen dieses Projekts, gezaehlt nach der Aenderung "
				+ "(§3.10). Derselbe Wert steht als reactionCount in Kachel und Detail.",
				example = "42")
		long count) {

	/** Fuer die Aufrufstelle lesbarer als der Konstruktor mit nacktem {@code long}. */
	public static ReactionResponse of(long count) {
		return new ReactionResponse(count);
	}
}
