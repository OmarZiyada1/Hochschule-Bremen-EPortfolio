package de.hsbremen.eportfolio.top10.dto;

import de.hsbremen.eportfolio.common.enums.Top10Action;
import de.hsbremen.eportfolio.project.dto.PersonResponse;
import de.hsbremen.eportfolio.project.dto.ProjectReferenceResponse;
import de.hsbremen.eportfolio.top10.Top10AuditEntry;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * Eine Zeile des Aenderungsprotokolls in der Antwort von
 * {@code GET /api/admin/top10-audit} (§3.17, §6.1).
 *
 * <p><strong>Es gibt kein Gegenstueck als Request.</strong> Das Protokoll hat
 * keinen schreibenden Endpoint; Zeilen entstehen ausschliesslich als Nebenwirkung
 * der vier Schreibwege aus §3.17.
 *
 * <p><strong>Zur Lesbarkeit einer Zeile.</strong> Die Anzeige braucht Zeitpunkt,
 * Name der handelnden Person, Aktion und betroffenes Projekt (KAN-40). Deshalb
 * stehen hier {@code admin} und {@code project} als kleine Verweise und nicht
 * deren IDs: mit blossen UUIDs muesste die Oberflaeche je Zeile zwei weitere
 * Abfragen stellen, um einen Namen zu zeigen.
 *
 * @param id               ID der Protokollzeile
 * @param timestamp        Zeitpunkt der Aenderung. Alle Zeilen eines Aufrufs von
 *                         {@code PUT /api/admin/top10} tragen denselben Wert
 *                         (§3.17); die Ordnung entscheidet deshalb zusaetzlich
 *                         {@code id} (§6.6)
 * @param admin            wer die Aenderung veranlasst hat. Bei einem Entzug
 *                         durch einen Statuswechsel ist das die Redaktion und
 *                         nicht die Administration (§3.17)
 * @param project          betroffenes Projekt. {@code null}, wenn es
 *                         zwischenzeitlich geloescht wurde: die Protokollzeile
 *                         bleibt stehen und verliert nur ihren Verweis (§3.17)
 * @param action           Art der Aenderung (§2.12)
 * @param previousPosition Platz vorher, gesetzt bei {@code REORDERED} und
 *                         {@code REMOVED}
 * @param newPosition      Platz nachher, gesetzt bei {@code REORDERED} und
 *                         {@code ADDED}
 */
@Schema(name = "Top10AuditEntryResponse",
		description = "Eine Zeile des unveraenderlichen Top-10-Protokolls (§3.17).")
public record Top10AuditEntryResponse(
		UUID id,

		@Schema(description = "Zeitpunkt der Aenderung. Mehrere Zeilen desselben Aufrufs "
				+ "tragen denselben Wert.")
		Instant timestamp,

		@Schema(description = "Wer die Aenderung veranlasst hat. Beim automatischen Entzug "
				+ "eines Platzes ist das die Person, die den Statuswechsel oder das Loeschen "
				+ "ausgeloest hat, also gegebenenfalls eine Redakteur:in.")
		PersonResponse admin,

		@Schema(description = "Betroffenes Projekt. Null, wenn das Projekt inzwischen "
				+ "geloescht wurde; die Protokollzeile bleibt trotzdem stehen.",
				nullable = true)
		ProjectReferenceResponse project,

		Top10Action action,

		@Schema(description = "Platz vor der Aenderung. Null bei ADDED.", example = "3",
				nullable = true)
		Integer previousPosition,

		@Schema(description = "Platz nach der Aenderung. Null bei REMOVED.", example = "1",
				nullable = true)
		Integer newPosition) {

	/**
	 * Baut die Antwort.
	 *
	 * <p>Anders als bei {@code Top10NominationResponse} kommt das Projekt hier aus
	 * der Entity und nicht von aussen: der Verweis braucht nur ID und Titel, und
	 * beides zieht der {@code @EntityGraph} des Repositories in derselben Abfrage
	 * mit.
	 */
	public static Top10AuditEntryResponse from(Top10AuditEntry entry) {
		return new Top10AuditEntryResponse(
				entry.getId(),
				entry.getTimestamp(),
				PersonResponse.from(entry.getAdmin()),
				ProjectReferenceResponse.from(entry.getProject()),
				entry.getAction(),
				entry.getPreviousPosition(),
				entry.getNewPosition());
	}
}
