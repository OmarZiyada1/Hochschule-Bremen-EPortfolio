package de.hsbremen.eportfolio.project.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Body von {@code POST /api/projects/{id}/request-revision} (§6.1): die
 * Begruendung, mit der die Redaktion ein Projekt zur Ueberarbeitung
 * zurueckgibt.
 *
 * <p><strong>Die Begruendung wird ein Kommentar, kein Historieneintrag.</strong>
 * §4.1 trennt die beiden ausdruecklich: die Statushistorie beantwortet „was ist
 * wann passiert", der {@code CHANGE_REQUEST}-Kommentar „was ist zu tun", und nur
 * Letzterer braucht einen Erledigungsstatus ({@code OPEN} / {@code RESOLVED},
 * §2.4). Der Uebergang schreibt deshalb beides: einen Eintrag in
 * {@code ProjectStatusHistory} ohne Text und einen Kommentar mit dem Text.
 *
 * <p><strong>Warum das Feld Pflicht ist.</strong> Ohne Begruendung wuesste die
 * Autor:in nur, dass ihr Projekt zurueckgekommen ist, nicht warum, und der
 * Kommentar traegt in {@code Comment.text} ein nicht-nullable Feld. Eine
 * Ruecknahme ohne Text waere damit entweder ein leerer Kommentar oder gar keiner;
 * beides macht den Arbeitsauftrag unauffindbar. Fehlt oder leer: <strong>400</strong>
 * {@code VALIDATION_FAILED}.
 *
 * <p><strong>Kein {@code version}-Feld</strong>, aus demselben Grund wie bei
 * {@link ProjectEditorsRequest}: §6.4 verlangt es „bei jedem schreibenden
 * Request", gemeint ist aber der Schutz vor stillem Datenverlust beim
 * gemeinsamen Bearbeiten. Ein Statusuebergang schreibt nur {@code status} und
 * {@code publishedAt} und kann deshalb niemandes Arbeit ueberschreiben. Gegen
 * den doppelten Aufruf schuetzt hier der Vorzustand aus §4.1 selbst: der zweite
 * Aufruf findet den erwarteten Ausgangsstatus nicht mehr vor und ergibt
 * <strong>409</strong> {@code PROJECT_STATUS_TRANSITION_INVALID}.
 *
 * @param reason Begruendung fuer die Ruecknahme. Wird woertlich zum
 *               {@code CHANGE_REQUEST}-Kommentar im Status {@code OPEN}
 */
public record RevisionRequest(
		@Schema(description = "Begruendung fuer die Ruecknahme. Sie wird zum "
				+ "CHANGE_REQUEST-Kommentar im Status OPEN und ist damit der Arbeitsauftrag an "
				+ "die Projektseite (§2.3, §4.1).",
				example = "Bitte die Quellenangaben im Abschnitt \"Methodik\" ergaenzen.")
		@NotBlank(message = "reason fehlt. Eine Ruecknahme ohne Begruendung laesst die Autor:in "
				+ "ohne Arbeitsauftrag zurueck (§4.1).")
		@Size(max = 5000, message = "reason ist zu lang (hoechstens 5000 Zeichen).")
		String reason) {
}
