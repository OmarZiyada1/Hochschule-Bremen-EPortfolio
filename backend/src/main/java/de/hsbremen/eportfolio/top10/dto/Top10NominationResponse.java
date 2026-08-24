package de.hsbremen.eportfolio.top10.dto;

import de.hsbremen.eportfolio.common.enums.NominationStatus;
import de.hsbremen.eportfolio.common.enums.NominationTier;
import de.hsbremen.eportfolio.project.dto.PersonResponse;
import de.hsbremen.eportfolio.project.dto.ProjectCardResponse;
import de.hsbremen.eportfolio.top10.Top10Nomination;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * Eine Nominierung in der Antwort von
 * {@code POST /api/projects/{id}/top10-nomination},
 * {@code GET /api/admin/top10-nominations} und den beiden
 * Entscheidungs-Endpoints (§3.11, §6.1).
 *
 * <p><strong>Ein DTO fuer alle fuenf Endpoints</strong> (seit Contract v68 kam
 * {@code GET /api/top10-nominations} dazu). Sie liefern denselben
 * Datensatz in verschiedenen Lebensphasen: offen, angenommen, abgelehnt. Zwei
 * Records mit denselben Feldern und nur anderer Nullbarkeit haetten dieselbe
 * Abbildung zweimal, und die Admin-Ansicht zeigt offene und entschiedene
 * Vorschlaege ohnehin in einer Liste (§3.11).
 *
 * <p><strong>Stufe und Platz stehen nebeneinander</strong> (seit Contract v68).
 * Die Stufe ist der Vorschlag der Redaktion, der Platz die Entscheidung der
 * Administration; erst zusammen zeigt die Zeile, was gewuenscht war und was
 * daraus wurde. Ein Feld fuer beides haette den Vorschlag ueberschrieben.
 *
 * <p><strong>Das Protokoll bleibt vollstaendig.</strong> Eine entschiedene
 * Nominierung verschwindet nicht, sie traegt danach zusaetzlich
 * {@code decidedBy} und {@code decidedAt}. Genau dafuer sind Nominierung und
 * Eintrag zwei Entitaeten und kein boolesches Feld am Projekt (§3.11).
 *
 * @param id               ID der Nominierung, zugleich Pfadwert von
 *                         {@code accept} und {@code reject}
 * @param project          die Projektkachel, damit die Admin-Ansicht ohne
 *                         zweiten Aufruf zeigen kann, worueber entschieden wird
 * @param nominatedBy      Redakteur:in oder Admin, die den Vorschlag gemacht hat
 * @param proposedTier     vorgeschlagene Stufe (§2.13), seit Contract v68 die
 *                         eigentliche Aussage des Vorschlags
 * @param proposedPosition seit Contract v68 der beim Annehmen entschiedene
 *                         Platz; leer, solange die Nominierung offen ist
 * @param status           Stand der Nominierung (§2.8)
 * @param decidedBy        wer entschieden hat: die Administration beim
 *                         Annehmen und Ablehnen, seit Contract v70 beim
 *                         Zurueckziehen auch die nominierende Redaktion,
 *                         seit v72 die Person, die den Uebergang aus
 *                         {@code PUBLISHED} ausgeloest hat (§3.11.1);
 *                         {@code null} solange {@code status = PENDING}
 * @param decidedAt        Zeitpunkt der Entscheidung, {@code null} solange offen
 * @param createdAt        Anlagezeitpunkt, zugleich das Sortierkriterium der
 *                         Admin-Liste
 */
public record Top10NominationResponse(
		UUID id,

		ProjectCardResponse project,

		PersonResponse nominatedBy,

		@Schema(description = "Vorgeschlagene Stufe (§2.13). Seit Contract v68 die Angabe, "
				+ "mit der die Redaktion nominiert.", example = "TOP_5")
		NominationTier proposedTier,

		@Schema(description = "Der von der Administration entschiedene Platz (§3.11). Gesetzt "
				+ "wird er seit Contract v69 allein von POST /admin/top10-nominations/{id}/"
				+ "accept. Null, solange die Nominierung offen ist, nach einer Ablehnung, und "
				+ "auch dann, wenn sie ueber PUT /admin/top10 mit angenommen wurde: dort steht "
				+ "der Platz allein im Top10Entry (§3.11.1 Regel 5).",
				example = "3", nullable = true)
		Integer proposedPosition,

		NominationStatus status,

		@Schema(description = "Wer entschieden hat: die Administration beim Annehmen und Ablehnen, seit Contract v70 beim Zurueckziehen auch die nominierende Redaktion, seit v72 die Person, die den Uebergang aus PUBLISHED ausgeloest hat. Null, solange status = PENDING ist.",
				nullable = true)
		PersonResponse decidedBy,

		@Schema(description = "Zeitpunkt der Entscheidung. Null, solange status = PENDING ist.",
				nullable = true)
		Instant decidedAt,

		Instant createdAt) {

	/**
	 * Baut die Antwort.
	 *
	 * <p>Die Kachel kommt von aussen und wird nicht aus
	 * {@code nomination.getProject()} abgeleitet: {@code ProjectCardResponse}
	 * braucht Tags und Reaktionszahl, die der Lesedienst fuer die ganze Liste in
	 * je einer Abfrage holt (siehe {@code ProjectReadService.cards}). Wuerde
	 * dieses Record sie selbst ziehen, entstuenden pro Zeile zwei zusaetzliche
	 * Abfragen.
	 *
	 * @param nomination die Nominierung mit geladener nominierender und ggf.
	 *                   entscheidender Person
	 * @param project    die bereits gebaute Kachel des nominierten Projekts
	 */
	public static Top10NominationResponse from(Top10Nomination nomination,
			ProjectCardResponse project) {

		return new Top10NominationResponse(
				nomination.getId(),
				project,
				PersonResponse.from(nomination.getNominatedBy()),
				nomination.getProposedTier(),
				nomination.getProposedPosition(),
				nomination.getStatus(),
				PersonResponse.from(nomination.getDecidedBy()),
				nomination.getDecidedAt(),
				nomination.getCreatedAt());
	}
}
