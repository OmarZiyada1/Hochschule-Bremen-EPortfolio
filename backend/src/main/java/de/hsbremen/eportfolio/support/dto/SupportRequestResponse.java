package de.hsbremen.eportfolio.support.dto;

import de.hsbremen.eportfolio.common.enums.SupportRequestCategory;
import de.hsbremen.eportfolio.common.enums.SupportRequestStatus;
import de.hsbremen.eportfolio.support.SupportRequest;
import de.hsbremen.eportfolio.user.dto.UserLookupResponse;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.UUID;

/**
 * Eine Support-Anfrage in den Antworten der Administrationsseite (§6.1, §3.20).
 *
 * <p><strong>Es gibt kein Gegenstueck fuer die absendende Person.</strong> Sie
 * hat auf ihre eigene Anfrage keinen lesenden Zugriff (§5), und
 * {@code POST /api/support} antwortet deshalb mit 201 ohne Koerper. Dieses
 * Record verlaesst den Server ausschliesslich hinter {@code /api/admin}.
 *
 * <p>{@code submittedByUserId} steht darin, obwohl keine Ansicht aus KAN-85 es
 * zeigt: §3.20 fuehrt es als Feld der Entity, und ein Antworttyp, der ein Feld
 * des Contracts stillschweigend weglaesst, waere die Art von Abweichung, die
 * erst beim naechsten Ticket auffaellt.
 *
 * @param id                die Kennung, zugleich der Pfadwert von {@code PATCH}
 *                          und {@code DELETE}
 * @param name              Name der absendenden Person, aus dem Formular
 * @param email             Adresse fuer die Antwort; die Oberflaeche baut daraus
 *                          den Verweis ins Mailprogramm
 * @param category          Einordnung nach §2.14
 * @param subject           Betreffzeile
 * @param message           der Text der Anfrage
 * @param status            Bearbeitungsstand nach §2.15
 * @param submittedByUserId das absendende Konto, sofern angemeldet, sonst
 *                          {@code null}
 * @param handledBy         das Admin-Konto, das den Stand zuletzt gesetzt hat,
 *                          sonst {@code null} (§3.20, seit v88)
 * @param handledAt         Zeitpunkt dieses Statuswechsels, sonst {@code null}
 * @param createdAt         Eingangszeitpunkt, zugleich die Sortierung der Liste
 * @param updatedAt         letzte Aenderung, in der Praxis der letzte
 *                          Statuswechsel
 */
@Schema(name = "SupportRequestResponse",
		description = "Eine eingegangene Support-Anfrage (§3.20). Wird ausschliesslich unter "
				+ "/api/admin ausgegeben.")
public record SupportRequestResponse(
		UUID id,

		@Schema(description = "Name der absendenden Person.", example = "Lena Brandt")
		String name,

		@Schema(description = "Adresse fuer die Antwort.", example = "lena.brandt@example.org")
		String email,

		SupportRequestCategory category,

		@Schema(description = "Betreffzeile.", example = "Anmeldung schlaegt fehl")
		String subject,

		String message,

		SupportRequestStatus status,

		/*
		 * nullable = true ist hier Pflicht und keine Zierde: ohne die
		 * Annotation fuehrt die generierte schema.d.ts das Feld als
		 * "string" statt "string | null", und das Frontend rechnete mit
		 * einem Wert, den es fuer jede Anfrage ohne Anmeldung nicht gibt
		 * (KAN-74, frontend/src/tests/api/schemaNullability.test.ts).
		 */
		@Schema(description = "Das absendende Konto, sofern angemeldet; sonst null (§3.20).",
				nullable = true)
		UUID submittedByUserId,

		/*
		 * Als Objekt und nicht als blosse Kennung, anders als
		 * submittedByUserId: die Liste zeigt hier einen Namen, und ein Nachladen
		 * je Zeile waere genau das N+1-Verhalten, das die uebrigen Lesedienste
		 * vermeiden. Beim Absender ist es umgekehrt, ihn zeigt keine Ansicht.
		 *
		 * UserLookupResponse und kein eigenes Record: dieselben drei Felder ein
		 * drittes Mal zu schreiben (neben PersonResponse) waere die Art
		 * Dopplung, die beim naechsten Nachtrag auseinanderlaeuft. Die
		 * hsbEmail bleibt damit ebenso ausgeschlossen wie dort (§3.1).
		 */
		@Schema(description = "Das Admin-Konto, das den Stand zuletzt gesetzt hat; "
				+ "sonst null (§3.20). Was der Name bedeutet, sagt das Feld status: "
				+ "bei IN_PROGRESS ist es die zustaendige Person, bei RESOLVED die "
				+ "erledigende, bei einem wieder geoeffneten OPEN die zurueckholende.",
				nullable = true)
		UserLookupResponse handledBy,

		@Schema(description = "Zeitpunkt des letzten Statuswechsels; sonst null. "
				+ "Immer zusammen mit handledBy gesetzt oder zusammen leer (§3.20).",
				nullable = true)
		Instant handledAt,

		Instant createdAt,

		Instant updatedAt) {

	/**
	 * Bildet die Entity ab.
	 *
	 * <p>Der Verweis auf das Konto wird bewusst nur als ID ausgegeben und nicht
	 * als eingebettetes Objekt: die Ansicht zeigt Name und Adresse aus dem
	 * Formular, nicht die des Kontos, und ein zweiter Name in derselben Antwort
	 * waere eine Einladung, den falschen anzuzeigen (§3.20).
	 */
	public static SupportRequestResponse from(SupportRequest request) {
		return new SupportRequestResponse(
				request.getId(),
				request.getName(),
				request.getEmail(),
				request.getCategory(),
				request.getSubject(),
				request.getMessage(),
				request.getStatus(),
				request.getSubmittedBy() == null ? null : request.getSubmittedBy().getId(),
				request.getHandledBy() == null
						? null
						: UserLookupResponse.from(request.getHandledBy()),
				request.getHandledAt(),
				request.getCreatedAt(),
				request.getUpdatedAt());
	}
}
