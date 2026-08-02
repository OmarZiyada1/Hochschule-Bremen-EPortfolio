package de.hsbremen.eportfolio.projekt.dto;

import de.hsbremen.eportfolio.common.enums.ProjektStatus;
import de.hsbremen.eportfolio.projekt.ProjektStatusHistorie;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;

/**
 * Ein Statusuebergang im Aktivitaetsverlauf eines Projekts (§3.12).
 *
 * <p>Die Historie hat bewusst keinen eigenen Endpoint, sondern haengt in
 * {@code ProjektDetailAntwort}: die UI zeigt den Verlauf ausschliesslich auf der
 * Projektdetailseite, ein zweiter Roundtrip haette keinen Nutzen.
 *
 * <p><strong>Sie ist nicht fuer alle sichtbar.</strong> Der Verlauf legt offen,
 * wie oft ein Projekt zurueckgewiesen wurde; das ist eine Information ueber den
 * Arbeitsprozess einer Person und gehoert nicht in die oeffentliche Darstellung
 * ihres Ergebnisses. Wer sie sehen darf, entscheidet
 * {@code ProjektBerechtigungService.darfProjektinternaSehen} (§5, Fussnote ⁷).
 *
 * @param vonStatus    Ausgangsstatus; {@code null} beim ersten Eintrag, weil es
 *                     dann keinen Vorzustand gibt
 * @param nachStatus   Zielstatus
 * @param geaendertVon wer den Uebergang ausgeloest hat
 * @param zeitpunkt    Zeitpunkt des Uebergangs
 */
public record StatusHistorieAntwort(
		@Schema(description = "Ausgangsstatus. Beim ersten Eintrag null, weil es dann "
				+ "keinen Vorzustand gibt.", nullable = true)
		ProjektStatus vonStatus,

		ProjektStatus nachStatus,

		PersonAntwort geaendertVon,

		Instant zeitpunkt) {

	public static StatusHistorieAntwort aus(ProjektStatusHistorie eintrag) {
		return new StatusHistorieAntwort(
				eintrag.getVonStatus(),
				eintrag.getNachStatus(),
				PersonAntwort.aus(eintrag.getGeaendertVon()),
				eintrag.getZeitpunkt());
	}
}
