package de.hsbremen.eportfolio.support.dto;

import de.hsbremen.eportfolio.common.enums.SupportRequestStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;

/**
 * Koerper von {@code PATCH /api/admin/support/{id}} (§6.1).
 *
 * <p>Genau ein Feld, und das ist keine Sparsamkeit, sondern die Regel aus
 * §3.20: eine Anfrage ist bis auf ihren Bearbeitungsstand unveraenderlich. Ein
 * zweites Feld hier waere ein Endpoint, der den Eingang umschreibt.
 *
 * @param status der neue Stand (§2.15). Ob der Uebergang erlaubt ist,
 *               entscheidet {@link SupportRequestStatus#mayTransitionTo}; ein
 *               nicht erlaubter ergibt 409
 *               {@code SUPPORT_STATUS_TRANSITION_INVALID}
 */
@Schema(name = "SupportRequestStatusUpdateRequest",
		description = "Neuer Bearbeitungsstand einer Support-Anfrage (§2.15).")
public record SupportRequestStatusUpdateRequest(

		@Schema(description = "Der neue Stand (§2.15).", example = "IN_PROGRESS")
		@NotNull(message = "Status fehlt.")
		SupportRequestStatus status) {
}
