package de.hsbremen.eportfolio.top10.dto;

import de.hsbremen.eportfolio.common.enums.NominationStatus;
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
 * <p><strong>Ein DTO fuer alle vier Endpoints.</strong> Sie liefern denselben
 * Datensatz in verschiedenen Lebensphasen: offen, angenommen, abgelehnt. Zwei
 * Records mit denselben Feldern und nur anderer Nullbarkeit haetten dieselbe
 * Abbildung zweimal, und die Admin-Ansicht zeigt offene und entschiedene
 * Vorschlaege ohnehin in einer Liste (§3.11).
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
 * @param proposedPosition unverbindlicher Platzvorschlag, kann fehlen
 * @param status           Stand der Nominierung (§2.8)
 * @param decidedBy        entscheidende:r Admin, {@code null} solange
 *                         {@code status = PENDING}
 * @param decidedAt        Zeitpunkt der Entscheidung, {@code null} solange offen
 * @param createdAt        Anlagezeitpunkt, zugleich das Sortierkriterium der
 *                         Admin-Liste
 */
public record Top10NominationResponse(
		UUID id,

		ProjectCardResponse project,

		PersonResponse nominatedBy,

		@Schema(description = "Unverbindlicher Platzvorschlag der nominierenden Person. "
				+ "Kann fehlen (§3.11).", example = "3", nullable = true)
		Integer proposedPosition,

		NominationStatus status,

		@Schema(description = "Entscheidende:r Admin. Null, solange status = PENDING ist.",
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
				nomination.getProposedPosition(),
				nomination.getStatus(),
				PersonResponse.from(nomination.getDecidedBy()),
				nomination.getDecidedAt(),
				nomination.getCreatedAt());
	}
}
