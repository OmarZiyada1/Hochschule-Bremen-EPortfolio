package de.hsbremen.eportfolio.editlock.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Antwort auf {@code POST /api/projects/{projectId}/edit-lock} (§6.9).
 *
 * <p><strong>Der Aufruf lehnt nie ab.</strong> Haelt jemand anders, ist das
 * keine Fehlersituation, sondern die Auskunft, auf die der Client wartet: er
 * bekommt 200 mit fremdem {@code holder} und {@code heldBySelf = false} und
 * kann daraufhin sagen, wer gerade schreibt. Ein 409 an dieser Stelle waere
 * doppelt falsch. Er zwaenge den Client, eine Fehlerantwort auszuwerten, um
 * einen voellig normalen Zustand anzuzeigen, und er verwechselte die Auskunft
 * mit der Durchsetzung. Abgewiesen wird erst der Schreibversuch, und zwar mit
 * 409 {@code PROJECT_LOCKED_BY_OTHER} an den schreibenden Endpoints (§6.1).
 *
 * @param holder     wer haelt. Nie {@code null}: nach diesem Aufruf haelt
 *                   immer jemand, entweder die aufrufende Person oder eine
 *                   andere
 * @param heldBySelf haelt die aufrufende Person selbst? Dann darf sie
 *                   schreiben
 */
public record EditLockResponse(
		EditLockHolderResponse holder,

		@Schema(description = "true, wenn die aufrufende Person die Sperre haelt und damit "
				+ "schreiben darf. Bei false gehoert die Sperre der in holder genannten Person, "
				+ "und der Editor bleibt zu.")
		boolean heldBySelf) {
}
