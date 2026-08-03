package de.hsbremen.eportfolio.project.dto;

import de.hsbremen.eportfolio.common.enums.ProjectStatus;
import de.hsbremen.eportfolio.project.ProjectStatusHistory;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Ein Statusuebergang im Aktivitaetsverlauf eines Projekts (§3.12).
 *
 * <p>Die Historie hat bewusst keinen eigenen Endpoint, sondern haengt in
 * {@code ProjectDetailResponse}: die UI zeigt den Verlauf ausschliesslich auf
 * der Projektdetailseite, ein zweiter Roundtrip haette keinen Nutzen.
 *
 * <p><strong>Sie ist nicht fuer alle sichtbar.</strong> Der Verlauf legt offen,
 * wie oft ein Projekt zurueckgewiesen wurde; das ist eine Information ueber den
 * Arbeitsprozess einer Person und gehoert nicht in die oeffentliche Darstellung
 * ihres Ergebnisses. Wer sie sehen darf, entscheidet
 * {@code ProjectPermissionService.maySeeProjectInternals} (§5, Fussnote ⁷).
 *
 * @param fromStatus Ausgangsstatus; {@code null} beim ersten Eintrag, weil es
 *                   dann keinen Vorzustand gibt
 * @param toStatus   Zielstatus
 * @param changedBy  wer den Uebergang ausgeloest hat
 * @param timestamp  Zeitpunkt des Uebergangs
 */
public record StatusHistoryResponse(
		@Schema(description = "Ausgangsstatus. Beim ersten Eintrag null, weil es dann "
				+ "keinen Vorzustand gibt.", nullable = true)
		ProjectStatus fromStatus,

		ProjectStatus toStatus,

		PersonResponse changedBy,

		Instant timestamp) {

	public static StatusHistoryResponse from(ProjectStatusHistory entry) {
		return new StatusHistoryResponse(
				entry.getFromStatus(),
				entry.getToStatus(),
				PersonResponse.from(entry.getChangedBy()),
				entry.getTimestamp());
	}
}
